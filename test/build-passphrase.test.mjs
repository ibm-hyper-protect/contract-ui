// Copyright (c) 2026 IBM Corp.
// All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};
globalThis.window = { localStorage, electron: { crypto: {} }, dispatchEvent() {} };
const { default: apiClient } = await import('../src/services/apiClient.js');
const { default: builds } = await import('../src/services/buildService.js');

test('all build-key API paths trim surrounding whitespace and retain internal spaces', async t => {
  const calls = [];
  t.mock.method(apiClient, 'post', async (path, payload) => {
    calls.push({ path, payload });
    return { data: {} };
  });
  for (const secret of [' \tCorrect! Inner Space2026\ufeff\n', '\u0085Keep!Internal2026\u0085', ' \t\n']) {
    const input = { mode: 'generate', passphrase: secret };
    await builds.registerSigningKey('build', input);
    await builds.registerAttestationKey('build', input);
    await builds.finalizeBuildV2('build', { signing_key_passphrase: secret });
    await builds.verifyAttestationEvidence('build', 'evidence', secret);
    const last = calls.slice(-4);
    assert.equal(last[0].payload.passphrase, secret.trim());
    assert.equal(last[1].payload.passphrase, secret.trim());
    assert.equal(last[2].payload.signing_key_passphrase, secret.trim());
    assert.equal(last[3].payload.attestation_key_passphrase, secret.trim());
    assert.equal(input.passphrase, secret);
  }
});
