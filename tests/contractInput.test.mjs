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

import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from 'js-yaml';
import { prepareContractInput } from '../src/utils/contractInput.js';
import { validateSubmissionYaml } from '../src/utils/submissionForm.js';

const pod = `apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: app
      image: example/image:1
`;

test('Podman multi-document manifests preserve Pods and ConfigMaps', () => {
  const config = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: settings\ndata:\n  HELLO: world\n';
  const result = load(prepareContractInput(pod + '---\n' + config, 'workload'));
  assert.equal(result.type, 'workload');
  assert.deepEqual(result.play.resources.map((value) => value.kind), ['Pod', 'ConfigMap']);
});

test('incorrect sections, duplicates and unsupported documents fail before review', () => {
  assert.throws(() => prepareContractInput(pod, 'env'));
  for (const input of ['type: workload\ntype: env', 'apiVersion: apps/v1\nkind: Deployment', 'type: env\n---\ntype: env', '[broken']) {
    assert.throws(() => prepareContractInput(input, 'workload'));
  }
});

test('raw environment variables are not mistaken for a contract wrapper', () => {
  const env = 'type: env\nenv:\n  HELLO: world\n';
  assert.equal(prepareContractInput(env, 'env'), env);
  assert.equal(validateSubmissionYaml(env, 'env'), '');
});

test('complete contracts retain the companion section for backend pair validation', () => {
  const contract = 'env: |\n  type: env\nworkload: |\n  type: workload\n';
  assert.equal(prepareContractInput(contract, 'workload'), contract);
  assert.equal(prepareContractInput(contract, 'env'), contract);
});
