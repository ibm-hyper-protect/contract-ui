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

import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'js-yaml';
import { prepareEnvironmentVolumes, readEnvironmentVolumes } from '../src/utils/environmentVolumes.js';
const env = 'type: env\nlogging: {logRouter: {hostname: logs.example.test, iamApiKey: test, port: 443}}\nenv: {UNCHANGED: value}\n';

test('environment volumes preserve other settings and exact seeds across add/edit/remove', () => {
  const rows = [{ name: 'database', seed: ' database seed ' }, { name: 'documents', seed: 'documentsSeed!2026' }];
  const prepared = prepareEnvironmentVolumes(env, rows);
  assert.deepEqual(load(prepared), { ...load(env), volumes: { database: { seed: ' database seed ' }, documents: { seed: 'documentsSeed!2026' } } });
  assert.equal(readEnvironmentVolumes(prepared)[0].seed, ' database seed ');
  assert.deepEqual(load(prepareEnvironmentVolumes(prepared, [])), load(env));
});

test('complete contracts preserve the workload and environment block-scalar representation', () => {
  for (const environment of [load(env), env]) {
    const source = JSON.stringify({ workload: { type: 'workload', compose: { archive: 'unchanged' } }, env: environment });
    const result = load(prepareEnvironmentVolumes(source, [{ name: 'data', seed: 'exactSeed!2026' }]));
    assert.deepEqual(result.workload, load(source).workload);
    const section = typeof result.env === 'string' ? load(result.env) : result.env;
    assert.equal(typeof result.env, typeof environment);
    assert.deepEqual(section.logging, load(env).logging);
    assert.equal(section.volumes.data.seed, 'exactSeed!2026');
  }
});

test('invalid sections, duplicate volumes and invalid seeds cannot silently overwrite data', () => {
  for (const source of ['', 'type: workload', 'type: env\nvolumes: []', 'type: env\nvolumes: {data: bad}']) {
    assert.throws(() => readEnvironmentVolumes(source));
  }
  for (const rows of [[{name:'__proto__',seed:'x'}], [{name:'data',seed:' '}], [{name:'data',seed:'one'}, {name:'data',seed:'two'}]]) {
    assert.throws(() => prepareEnvironmentVolumes(env, rows));
  }
});
