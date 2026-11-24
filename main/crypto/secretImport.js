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

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_BYTES = 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY_ID = /^[A-Za-z0-9._-]{1,80}$/;

function importKey(info) {
  if (!info || !KEY_ID.test(info.key_id) || typeof info.public_key_pem !== 'string' || info.public_key_pem.length > 16384) {
    throw new Error('Invalid secret import key.');
  }
  const key = crypto.createPublicKey(info.public_key_pem);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength !== 4096 || key.asymmetricKeyDetails.publicExponent !== 65537n) {
    throw new Error('RSA-4096 secret import key required.');
  }
  const fingerprint = crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
  if (fingerprint !== info.fingerprint || info.key_id !== fingerprint || info.max_bytes !== MAX_BYTES) {
    throw new Error('The import key does not match its fingerprint or protocol.');
  }
  return { key, fingerprint };
}

function serverIdentity(raw) {
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid secret store server address.');
  }
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Use HTTPS or a loopback SSH tunnel for the Secret Store.');
  }
  return url.href.replace(/\/+$/, '');
}

function createSecretImport({ directory, getServerUrl }) {
  const pinsFile = () => path.join(directory(), 'secret-import-pins.json');
  async function pins() {
    try { return JSON.parse(await fs.readFile(pinsFile(), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Cannot read trusted import keys.'); }
  }
  async function identity(serverUrl) {
    const requested = serverIdentity(serverUrl);
    if (requested !== serverIdentity(await getServerUrl())) throw new Error('The configured server changed. Reopen the import dialog.');
    return requested;
  }
  return {
    async status({ serverUrl, info }) {
      const server = await identity(serverUrl);
      const { fingerprint } = importKey(info);
      const saved = (await pins())[server];
      return { trusted: saved === fingerprint, changed: Boolean(saved && saved !== fingerprint), fingerprint };
    },
    async trust({ serverUrl, info, confirmedFingerprint }) {
      const server = await identity(serverUrl);
      const { fingerprint } = importKey(info);
      if (confirmedFingerprint !== fingerprint) throw new Error('Confirm the full worker fingerprint before trusting this key.');
      const saved = await pins(); saved[server] = fingerprint;
      await fs.mkdir(directory(), { recursive: true, mode: 0o700 });
      const temporary = pinsFile() + '.' + crypto.randomUUID() + '.tmp';
      try {
        await fs.writeFile(temporary, JSON.stringify(saved), { mode: 0o600, flag: 'wx' });
        await fs.rename(temporary, pinsFile());
      } finally { await fs.unlink(temporary).catch(() => {}); }
      return { trusted: true, fingerprint };
    },
    async seal({ serverUrl, info, secretId, versionId, filePath, text }) {
      const server = await identity(serverUrl);
      const { key, fingerprint } = importKey(info);
      if ((await pins())[server] !== fingerprint) throw new Error('Verify and trust this server’s secret import key first.');
      if (!UUID.test(secretId) || !UUID.test(versionId)) throw new Error('Invalid reserved secret version.');
      if ((typeof filePath === 'string') === (typeof text === 'string')) throw new Error('Choose one secret source.');
      let value;
      if (typeof filePath === 'string') {
        const handle = await fs.open(filePath, 'r');
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Choose a regular file of at most 64 KiB.');
          value = Buffer.alloc(MAX_BYTES + 1);
          let offset = 0;
          while (offset < value.length) {
            const { bytesRead } = await handle.read(value, offset, value.length - offset, null);
            if (!bytesRead) break;
            offset += bytesRead;
          }
          if (offset > MAX_BYTES) { value.fill(0); throw new Error('Secret value exceeds 64 KiB.'); }
          value = value.subarray(0, offset);
        } catch (error) { value?.fill(0); throw error; }
        finally { await handle.close(); }
      } else {
        if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw new Error('Secret value exceeds 64 KiB.');
        value = Buffer.from(text, 'utf8');
      }
      const dek = crypto.randomBytes(32);
      try {
        const nonce = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce);
        cipher.setAAD(Buffer.from('contract-secret-import-v1\n' + secretId + '\n' + versionId + '\n', 'ascii'));
        const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
        const wrapped = crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, dek);
        return {
          format: 1, secret_id: secretId, version_id: versionId, key_id: info.key_id,
          wrapped_key: wrapped.toString('base64'), nonce: nonce.toString('base64'),
          ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64')
        };
      } finally { dek.fill(0); value.fill(0); }
    }
  };
}

module.exports = { createSecretImport, importKey, MAX_BYTES };
