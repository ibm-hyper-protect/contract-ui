/*
Copyright (c) 2026 IBM Corp.
All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { gzipSync } = require('node:zlib');
const yaml = require('js-yaml');
const mapping = value => value && typeof value === 'object' && !Array.isArray(value);
const MAX_COMPOSE_BYTES = 1024 * 1024;

// A single fixed archive entry avoids shell execution and filesystem access.
function archiveCompose(content) {
  const bytes = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512);
  const put = (value, offset, length) => header.write(value, offset, length, 'ascii');
  put('docker-compose.yaml', 0, 100);
  put('0000600\0', 100, 8);
  put('0000000\0', 108, 8);
  put('0000000\0', 116, 8);
  put(bytes.length.toString(8).padStart(11, '0') + '\0', 124, 12);
  put('00000000000\0', 136, 12);
  put('        ', 148, 8);
  put('0', 156, 1);
  put('ustar\0', 257, 6);
  put('00', 263, 2);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  put(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return gzipSync(Buffer.concat([header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512 + 1024)]));
}

function inspectCompose(content) {
  if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content, 'utf8') > MAX_COMPOSE_BYTES) {
    throw new Error('Choose a non-empty Compose YAML file no larger than 1 MB.');
  }
  let compose;
  try { compose = yaml.load(content, { schema: yaml.JSON_SCHEMA }); }
  catch { throw new Error('The Compose file contains invalid YAML or multiple documents.'); }
  if (!mapping(compose) || !mapping(compose.services) || !Object.keys(compose.services).length) {
    throw new Error('The Compose file must contain a non-empty services mapping.');
  }
  if (compose.include !== undefined) throw new Error('Compose include requires extra files. Use a complete contract archive instead.');
  for (const [name, service] of Object.entries(compose.services)) {
    if (!mapping(service) || typeof service.image !== 'string' || !service.image.trim()) {
      throw new Error(`Service ${name} needs a registry image. Build and push the image before importing.`);
    }
    for (const field of ['build', 'env_file', 'label_file', 'extends', 'develop']) {
      if (service[field] !== undefined) throw new Error(`Service ${name} uses ${field}. This importer accepts self-contained Compose files only.`);
    }
    if (service.volumes !== undefined && !Array.isArray(service.volumes)) throw new Error(`Service ${name} volumes must be a list.`);
    for (const volume of service.volumes || []) {
      const source = typeof volume === 'string' ? volume.split(':')[0] : volume?.type === 'bind' ? volume.source : null;
      if (source && (/^(\.|~|[A-Za-z]:|\\)/.test(source) ||
          (typeof volume === 'object' && volume.type === 'bind' && !source.startsWith('/')) ||
          (source.includes('/') && !source.startsWith('/')))) {
        throw new Error(`Service ${name} references a local bind path. Use an absolute guest path or prepare a complete archive.`);
      }
    }
  }
  for (const kind of ['configs', 'secrets', 'volumes']) {
    if (compose[kind] !== undefined && !mapping(compose[kind])) throw new Error(`Compose ${kind} must be a mapping.`);
    for (const item of Object.values(compose[kind] || {})) {
      if (item?.file !== undefined || item?.environment !== undefined || item?.external) {
        throw new Error(`Compose ${kind} references an external file, value or resource. Use inline content or prepare a complete archive.`);
      }
    }
  }
  const visited = new Set();
  const visit = (value, ancestors = new Set()) => {
    if (typeof value === 'string' && /(?<!\$)\$(?:\{|[A-Za-z_])/.test(value)) {
      throw new Error('Resolve Compose environment substitutions before importing; your local .env file is not included.');
    }
    if (value && typeof value === 'object') {
      if (ancestors.has(value)) throw new Error('Recursive YAML aliases are not supported.');
      if (visited.has(value)) return;
      visited.add(value);
      const next = new Set(ancestors).add(value);
      for (const child of Object.values(value)) visit(child, next);
    }
  };
  visit(compose);
  return { compose, services: Object.keys(compose.services), images: Object.values(compose.services).map(service => service.image) };
}

function prepareVolumes(volumes) {
  const result = Object.create(null);
  if (!Array.isArray(volumes)) throw new Error('Persistent volumes must be a list.');
  const names = new Set();
  const mounts = new Set();
  for (const volume of volumes) {
    if (!mapping(volume) || typeof volume.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/.test(volume.name) ||
        typeof volume.mount !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/?)+$/.test(volume.mount) ||
        typeof volume.seed !== 'string' || !volume.seed.trim() || volume.seed.length > 4096) {
      throw new Error('Provide a volume name, absolute guest mount path and workload seed.');
    }
    const mount = volume.mount.replace(/\/+$/, '');
    if (names.has(volume.name)) throw new Error(`Volume name ${volume.name} is used more than once.`);
    if (mounts.has(mount)) throw new Error(`Guest mount path ${mount} is used more than once.`);
    names.add(volume.name);
    mounts.add(mount);
    result[volume.name] = { mount, filesystem: 'ext4', seed: volume.seed };
  }
  return result;
}

/** Build workload YAML without reading local references or changing secrets. */
function prepareComposeWorkload({ content, volumes = [] } = {}) {
  const { compose: _compose, ...summary } = inspectCompose(content);
  const workload = { type: 'workload', compose: { archive: archiveCompose(content).toString('base64') } };
  const preparedVolumes = prepareVolumes(volumes);
  if (volumes.length) workload.volumes = preparedVolumes;
  return { plaintext: yaml.dump(workload, { noRefs: true, lineWidth: -1 }), ...summary };
}

/** Prepare explicitly selected Compose definitions or Podman Pod/ConfigMap manifests.
 * Disjoint Compose definitions are combined; conflicting definitions require an
 * explicitly resolved Compose file, rather than guessing override semantics.
 */
function prepareWorkload({ format, files, volumes = [] } = {}) {
  if (!['compose', 'play'].includes(format) || !Array.isArray(files) || !files.length || files.length > 32) {
    throw new Error('Choose a format and between 1 and 32 YAML files.');
  }
  let total = 0;
  const names = new Set();
  for (const file of files) {
    if (!mapping(file) || typeof file.name !== 'string' || !/\.ya?ml$/i.test(file.name) ||
        names.has(file.name) || typeof file.content !== 'string' || !file.content.trim() ||
        Buffer.byteLength(file.content, 'utf8') > MAX_COMPOSE_BYTES) {
      throw new Error('Choose non-empty YAML files with unique names, each no larger than 1 MB.');
    }
    names.add(file.name);
    total += Buffer.byteLength(file.content, 'utf8');
  }
  if (total > 5 * MAX_COMPOSE_BYTES) throw new Error('Selected YAML files must total no more than 5 MB.');
  if (format === 'compose') {
    const combined = Object.create(null);
    for (const file of files) {
      const { compose } = inspectCompose(file.content);
      for (const [key, value] of Object.entries(compose)) {
        if (!Object.hasOwn(combined, key)) { combined[key] = value; continue; }
        if (mapping(value) && mapping(combined[key])) {
          for (const [name, entry] of Object.entries(value)) {
            if (Object.hasOwn(combined[key], name)) {
              throw new Error(`Compose ${key}.${name} occurs in multiple files. Resolve overrides with docker compose config and import the resolved file.`);
            }
            Object.defineProperty(combined[key], name, { value: entry, enumerable: true });
          }
        } else if (value !== combined[key]) {
          throw new Error(`Compose ${key} conflicts between files. Import a resolved Compose file.`);
        }
      }
    }
    const content = files.length === 1 ? files[0].content : yaml.dump(combined, { noRefs: true, lineWidth: -1 });
    return prepareComposeWorkload({ content, volumes });
  }
  const resources = [];
  const identities = new Set();
  for (const file of files) {
    let documents;
    try { documents = yaml.loadAll(file.content, undefined, { schema: yaml.JSON_SCHEMA }); }
    catch { throw new Error(`${file.name} contains invalid YAML.`); }
    for (const item of documents) {
      if (!mapping(item) || item.apiVersion !== 'v1' || !['Pod', 'ConfigMap'].includes(item.kind) ||
          !mapping(item.metadata) || typeof item.metadata.name !== 'string' || !item.metadata.name.trim()) {
        throw new Error('Podman Play import accepts v1 Pod and ConfigMap documents with metadata.name.');
      }
      const identity = JSON.stringify([item.kind, item.metadata.namespace || '', item.metadata.name]);
      if (identities.has(identity)) throw new Error(`Duplicate ${item.kind}: ${item.metadata.name}.`);
      identities.add(identity);
      try { JSON.stringify(item); }
      catch { throw new Error('Recursive YAML aliases are not supported.'); }
      resources.push(item);
    }
  }
  const preparedVolumes = prepareVolumes(volumes);
  const prepared = { type: 'workload', play: { resources } };
  if (volumes.length) prepared.volumes = preparedVolumes;
  return { plaintext: yaml.dump(prepared, { noRefs: true, lineWidth: -1 }) };
}

module.exports = { prepareComposeWorkload, prepareWorkload };
