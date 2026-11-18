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

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const { gunzipSync } = require('node:zlib');
const { prepareWorkload } = require('../main/composeWorkload');
const pod = 'apiVersion: v1\nkind: Pod\nmetadata: {name: api}\nspec: {containers: [{name: api, image: registry.example/api:1}]}\n';
const config = 'apiVersion: v1\nkind: ConfigMap\nmetadata: {name: configuration}\ndata: {GREETING: Grüße}\n';
const file = (name, content) => ({ name, content });

test('Podman imports multiple files/documents in order without a Compose archive', () => {
  const result = yaml.load(prepareWorkload({ format: 'play', files: [file('config.yaml', config), file('pod.yaml', pod)],
    volumes: [{ name: 'data', mount: '/mnt/data', seed: ' exact seed ' }] }).plaintext);
  assert.equal(result.compose, undefined);
  assert.deepEqual(result.play.resources.map(item => item.kind), ['ConfigMap', 'Pod']);
  assert.equal(result.play.resources[0].data.GREETING, 'Grüße');
  assert.equal(result.volumes.data.seed, ' exact seed ');
  const multi = yaml.load(prepareWorkload({ format: 'play', files: [file('all.yml', config + '---\n' + pod)] }).plaintext);
  assert.deepEqual(multi.play.resources, result.play.resources);
});

test('combines disjoint Compose services into one canonical archive', () => {
  const result = yaml.load(prepareWorkload({ format: 'compose', files: [
    file('api.yml', 'services: {api: {image: registry.example/api:1}}'),
    file('database.yml', 'services: {database: {image: registry.example/db:1}}'),
  ] }).plaintext);
  const tar = gunzipSync(Buffer.from(result.compose.archive, 'base64'));
  const size = parseInt(tar.subarray(124, 136).toString(), 8);
  const combined = yaml.load(tar.subarray(512, 512 + size).toString());
  assert.deepEqual(Object.keys(combined.services), ['api', 'database']);
});

test('rejects implicit Compose overrides instead of changing their semantics', () => {
  assert.throws(() => prepareWorkload({ format: 'compose', files: [file('one.yml', 'services: {api: {image: a}}'), file('two.yml', 'services: {api: {image: b}}')] }), /Resolve overrides/);
});

test('validates file batches, formats, Podman kinds and duplicate resources at IPC boundary', () => {
  for (const options of [
    {}, { format: 'bad', files: [file('pod.yaml', pod)] }, { format: 'play', files: [] },
    { format: 'play', files: [file('pod.yaml', pod), file('pod.yaml', pod)] },
    { format: 'play', files: [file('pod.yaml', pod), file('other.yaml', pod)] },
    { format: 'play', files: [file('empty.yaml', '')] },
    { format: 'play', files: [file('large.yaml', 'x'.repeat(1024 * 1024 + 1))] },
    { format: 'play', files: [file('compose.yaml', 'services: {}')] },
    { format: 'play', files: [file('deploy.yaml', pod.replace('kind: Pod', 'kind: Deployment'))] },
    { format: 'play', files: [file('cycle.yaml', pod + 'cycle: &cycle [*cycle]')] },
  ]) assert.throws(() => prepareWorkload(options));
});
