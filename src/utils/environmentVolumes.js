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

import { load, dump, JSON_SCHEMA } from 'js-yaml';
const mapping = value => value && typeof value === 'object' && !Array.isArray(value);

function parseEnvironment(content) {
  const root = load(content, { schema: JSON_SCHEMA });
  if (!mapping(root)) throw new Error('Add valid environment YAML first.');
  const wrapped = root.type === undefined && root.workload !== undefined;
  const section = wrapped ? (typeof root.env === 'string' ? load(root.env, { schema: JSON_SCHEMA }) : root.env) : root;
  if (!mapping(section) || section.type !== 'env') throw new Error('Use type: env YAML or a complete plaintext contract.');
  if (section.volumes !== undefined && !mapping(section.volumes)) throw new Error('Environment volumes must be a mapping.');
  return { root, section, wrapped };
}

/** Read only this persona’s volume declarations; never copy workload secrets. */
export function readEnvironmentVolumes(content) {
  const { section } = parseEnvironment(content);
  return Object.entries(section.volumes || {}).map(([name, value], id) => {
    if (!mapping(value) || (value.seed !== undefined && typeof value.seed !== 'string')) throw new Error(`Invalid environment volume: ${name}. Edit it in YAML.`);
    return { id, name, seed: value.seed || '' };
  });
}

/** Update environment volumes while preserving logging, registry and wrapper data. */
export function prepareEnvironmentVolumes(content, volumes) {
  const { root, section, wrapped } = parseEnvironment(content);
  const prepared = Object.create(null);
  for (const volume of volumes) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/.test(volume.name) ||
        typeof volume.seed !== 'string' || !volume.seed.trim() || volume.seed.length > 4096) {
      throw new Error('Provide a volume name and environment seed for each volume.');
    }
    if (Object.hasOwn(prepared, volume.name)) throw new Error(`Volume name ${volume.name} is used more than once.`);
    prepared[volume.name] = { ...section.volumes?.[volume.name], seed: volume.seed };
  }
  if (volumes.length) section.volumes = prepared;
  else delete section.volumes;
  if (wrapped) root.env = typeof root.env === 'string' ? dump(section, { noRefs: true, lineWidth: -1 }) : section;
  return dump(root, { noRefs: true, lineWidth: -1 });
}
