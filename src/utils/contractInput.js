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

import { loadAll, dump, JSON_SCHEMA } from 'js-yaml';

const mapping = (value) => value && typeof value === 'object' && !Array.isArray(value);

/**
 * Prepare a raw section or complete contract for backend schema validation.
 * Pod/ConfigMap documents become workload play resources in their original order.
 * @param {string} content - YAML input from the editor or uploaded file.
 * @param {'workload'|'env'} section - Section accepted by the current persona.
 * @returns {string} Original contract YAML or normalized Podman workload YAML.
 * @throws {Error} When YAML is malformed or does not match a supported input form.
 */
export function prepareContractInput(content, section) {
  const documents = loadAll(content, undefined, { schema: JSON_SCHEMA });
  if (!documents.length || documents.some((value) => !mapping(value))) {
    throw new Error('YAML must contain a mapping, not an empty document, scalar or list.');
  }
  const manifests = documents.every(
    (value) => value.apiVersion === 'v1' && ['Pod', 'ConfigMap'].includes(value.kind)
  );
  if (manifests) {
    if (section !== 'workload') throw new Error('Podman play YAML belongs in the workload section.');
    return dump({ type: 'workload', play: { resources: documents } }, { noRefs: true, lineWidth: -1 });
  }
  if (documents.length !== 1) {
    throw new Error('Use one contract YAML document, or Pod/ConfigMap documents for Podman play.');
  }
  const root = documents[0];
  if (root.type !== undefined) {
    if (root.type !== section) throw new Error(`Expected type: ${section}.`);
  } else if (!root.workload || !root.env) {
    throw new Error(`Use raw type: ${section} YAML or a complete contract with workload and env.`);
  }
  return content;
}

export const PODMAN_WORKLOAD_TEMPLATE = `type: workload
play:
  resources:
    - apiVersion: v1
      kind: Pod
      metadata:
        name: workload
      spec:
        containers:
          - name: app
            image: registry.example/namespace/image:tag
`;
