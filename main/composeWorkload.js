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
  return { services: Object.keys(compose.services), images: Object.values(compose.services).map(service => service.image) };
}

/** Build workload YAML without reading local references or changing secrets. */
function prepareComposeWorkload({ content, volume } = {}) {
  const summary = inspectCompose(content);
  const workload = { type: 'workload', compose: { archive: archiveCompose(content).toString('base64') } };
  if (volume != null) {
    if (!mapping(volume) || typeof volume.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/.test(volume.name) ||
        typeof volume.mount !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/?)+$/.test(volume.mount) ||
        typeof volume.seed !== 'string' || !volume.seed.trim() || volume.seed.length > 4096) {
      throw new Error('Provide a volume name, absolute guest mount path and workload seed.');
    }
    workload.volumes = { [volume.name]: { mount: volume.mount, filesystem: 'ext4', seed: volume.seed } };
  }
  return { plaintext: yaml.dump(workload, { noRefs: true, lineWidth: -1 }), ...summary };
}

module.exports = { prepareComposeWorkload };
