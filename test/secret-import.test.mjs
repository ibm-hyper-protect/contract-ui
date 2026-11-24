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
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { createSecretImport, MAX_BYTES } = require('../main/crypto/secretImport');
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 4096 });
const fingerprint = crypto.createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
const info = { key_id: fingerprint, fingerprint, public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }), max_bytes: MAX_BYTES };
const serverUrl = 'http://127.0.0.1:18081';
const context = { serverUrl, info, secretId: crypto.randomUUID(), versionId: crypto.randomUUID() };
const decrypt = e => {
  const dek = crypto.privateDecrypt({ key: pair.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(e.wrapped_key, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(e.nonce, 'base64'));
  d.setAAD(Buffer.from(`contract-secret-import-v1\n${e.secret_id}\n${e.version_id}\n`, 'ascii'));
  d.setAuthTag(Buffer.from(e.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(e.ciphertext, 'base64')), d.final()]);
};
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'secret-import-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const service = createSecretImport({ directory: () => directory, getServerUrl: () => serverUrl });
  return { directory, service, trust: () => service.trust({ serverUrl, info, confirmedFingerprint: fingerprint }) };
}
test('secret import requires explicit server-bound trust and detects changed keys', async t => {
  const { service, trust, directory } = await fixture(t);
  assert.equal((await service.status({ serverUrl, info })).trusted, false);
  await assert.rejects(service.seal({ ...context, text: 'dummy' }), /trust/);
  await assert.rejects(service.trust({ serverUrl, info, confirmedFingerprint: 'short' }), /fingerprint/);
  await trust();
  assert.equal((await service.status({ serverUrl, info })).trusted, true);
  assert.equal((await stat(path.join(directory, 'secret-import-pins.json'))).mode & 0o777, 0o600);
  await assert.rejects(service.seal({ ...context, serverUrl: 'https://another.example', text: 'dummy' }), /server changed/);
  await assert.rejects(service.seal({ ...context, serverUrl: 'http://another.example', text: 'dummy' }), /HTTPS/);
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 4096 }).publicKey;
  const fp = crypto.createHash('sha256').update(other.export({ type: 'spki', format: 'der' })).digest('hex');
  const changed = { ...info, fingerprint: fp, key_id: fp, public_key_pem: other.export({ type: 'spki', format: 'pem' }) };
  assert.deepEqual(await service.status({ serverUrl, info: changed }), { trusted: false, changed: true, fingerprint: fp });
  await assert.rejects(service.seal({ ...context, info: changed, text: 'dummy' }), /trust/);
});
test('desktop import preserves binary bytes, whitespace, empty values and maximum size', async t => {
  const { service, trust, directory } = await fixture(t); await trust();
  for (const value of ['', '  leading and trailing  ', 'multiline\n\tvalue\n']) {
    const e = await service.seal({ ...context, text: value });
    assert.deepEqual(decrypt(e), Buffer.from(value));
    assert.deepEqual(Object.keys(e).sort(), ['format', 'secret_id', 'version_id', 'key_id', 'wrapped_key', 'nonce', 'ciphertext', 'tag'].sort());
    assert.equal(JSON.stringify(e).includes('leading and trailing'), false);
  }
  const filePath = path.join(directory, 'binary');
  const value = Buffer.alloc(MAX_BYTES, 0xff); value[0] = 0;
  await writeFile(filePath, value);
  assert.deepEqual(decrypt(await service.seal({ ...context, filePath })), value);
  assert.deepEqual(await readFile(filePath), value);
  await writeFile(filePath, Buffer.alloc(MAX_BYTES + 1));
  await assert.rejects(service.seal({ ...context, filePath }), /64 KiB/);
  await assert.rejects(service.seal({ ...context, text: 'x'.repeat(MAX_BYTES + 1) }), /64 KiB/);
  await assert.rejects(service.seal({ ...context, text: '', filePath }), /one secret source/);
  await assert.rejects(service.seal({ ...context, secretId: 'bad', text: '' }), /reserved secret/);
  await assert.rejects(service.seal({ ...context, info: { ...info, fingerprint: 'wrong' }, text: '' }), /fingerprint/);
});
