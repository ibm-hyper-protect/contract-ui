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
const { gunzipSync } = require('node:zlib');
const yaml = require('js-yaml');
const { prepareComposeWorkload } = require('../main/composeWorkload');
const minimal = 'services:\n  app:\n    image: registry.example/app:1\n';

test('creates a readable ustar/gzip archive with the original UTF-8 Compose bytes', () => {
  const content = minimal + '    environment:\n      MESSAGE: "Grüße $$HOME"\n';
  const result = prepareComposeWorkload({ content });
  const workload = yaml.load(result.plaintext);
  assert.equal(workload.type, 'workload');
  const tar = gunzipSync(Buffer.from(workload.compose.archive, 'base64'));
  assert.equal(tar.subarray(0, 100).toString().replace(/\0.*$/s, ''), 'docker-compose.yaml');
  assert.equal(tar.subarray(257, 263).toString(), 'ustar\0');
  const size = parseInt(tar.subarray(124, 136).toString(), 8);
  assert.equal(tar.subarray(512, 512 + size).toString(), content);
  assert.equal(tar.length % 512, 0);
  assert.ok(tar.subarray(-1024).every(byte => byte === 0));
  assert.deepEqual(result.services, ['app']);
  assert.equal(workload.volumes, undefined);
});

test('optional volume preserves the exact seed and does not invent credentials', () => {
  const result = prepareComposeWorkload({ content: minimal, volumes: [{ name: 'data', mount: '/mnt/data', seed: ' existing seed ' }] });
  assert.deepEqual(yaml.load(result.plaintext).volumes.data, { mount: '/mnt/data', filesystem: 'ext4', seed: ' existing seed ' });
});

for (const [label, content] of [
  ['missing services', 'type: workload'],
  ['empty services', 'services: {}'],
  ['missing image', 'services:\n  app: {}'],
  ['multiple documents', minimal + '\n---\nservices: {}'],
  ['duplicate service keys', minimal + '  app: {}'],
  ['build context', minimal + '    build: .'],
  ['env file', minimal + '    env_file: .env'],
  ['include', minimal + 'include: extra.yaml'],
  ['relative bind', minimal + '    volumes: ["./local:/data"]'],
  ['long relative bind', minimal + '    volumes:\n      - type: bind\n        source: local\n        target: /data'],
  ['relative subdirectory bind', minimal + '    volumes: ["local/config:/data"]'],
  ['external config', minimal + 'configs:\n  app:\n    file: ./config'],
  ['external volume', minimal + 'volumes:\n  data:\n    external: true'],
  ['interpolation', minimal + '    environment:\n      PASSWORD: ${PASSWORD}'],
  ['recursive aliases', 'services:\n  app: &app\n    image: example/app\n    environment:\n      CYCLE: *app'],
]) test('rejects ' + label + ' instead of producing an incomplete archive', () => {
  assert.throws(() => prepareComposeWorkload({ content }));
});

test('validates IPC inputs and volume paths', () => {
  for (const content of [null, {}, '', 'x'.repeat(1024 * 1024 + 1)]) assert.throws(() => prepareComposeWorkload({ content }));
  for (const volume of [{name: '__proto__', mount: '/mnt/data', seed: 'x'}, {name: 'data', mount: '../data', seed: 'x'}, {name: 'data', mount: '/', seed: 'x'}, {name: 'data', mount: '/data', seed: ' '}]) {
    assert.throws(() => prepareComposeWorkload({ content: minimal, volumes: [volume] }));
  }
});

test('multiple independent volumes preserve every name, mount and exact seed', () => {
  const volumes = [
    { name: 'database', mount: '/mnt/database', seed: ' database seed ' },
    { name: 'documents', mount: '/mnt/documents/', seed: ' documents seed\n' },
  ];
  const result = yaml.load(prepareComposeWorkload({ content: minimal, volumes }).plaintext);
  assert.deepEqual(result.volumes, {
    database: { mount: '/mnt/database', filesystem: 'ext4', seed: ' database seed ' },
    documents: { mount: '/mnt/documents', filesystem: 'ext4', seed: ' documents seed\n' },
  });
  assert.equal(volumes[1].mount, '/mnt/documents/');
});

test('rejects duplicate names, duplicate normalized mounts and malformed lists', () => {
  const first = { name: 'data', mount: '/mnt/data', seed: 'unchanged' };
  for (const volumes of [
    [first, { ...first, mount: '/mnt/other' }],
    [first, { ...first, name: 'other', mount: '/mnt/data/' }],
    [first, { ...first, name: 'other', mount: '/mnt/other', seed: ' ' }],
    [null], {}, null,
  ]) assert.throws(() => prepareComposeWorkload({ content: minimal, volumes }));
  assert.equal(yaml.load(prepareComposeWorkload({ content: minimal, volumes: [] }).plaintext).volumes, undefined);
});
