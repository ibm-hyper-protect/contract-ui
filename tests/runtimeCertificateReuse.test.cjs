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
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectRuntimeCertificate } = require('../main/crypto/runtimeCertificate');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'certificate-reuse-test-'));
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir,'key.pem'), '-out', path.join(dir,'cert.pem'), '-days', '1', '-subj', '/CN=Disposable test runtime'], {stdio:'ignore'});
} catch (error) { fs.rmSync(dir,{recursive:true,force:true}); throw error; }
const pem = fs.readFileSync(path.join(dir,'cert.pem'),'utf8');
process.on('exit', () => fs.rmSync(dir,{recursive:true,force:true}));
test('returns public certificate identity without returning private key material', () => {
  const result = inspectRuntimeCertificate(pem);
  assert.match(result.subject, /Disposable test runtime/);
  assert.match(result.fingerprint, /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
  assert.equal(result.content.trim(), pem.trim());
  assert.equal(Object.keys(result).some(key=>key.toLowerCase().includes('private')), false);
});
test('rejects malformed PEM, private keys, chains and oversized IPC messages', () => {
  for (const value of [null, {}, '', '-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----', fs.readFileSync(path.join(dir,'key.pem'),'utf8'), pem+pem, pem+fs.readFileSync(path.join(dir,'key.pem'),'utf8'), 'x'.repeat(10241)]) {
    assert.throws(()=>inspectRuntimeCertificate(value));
  }
});
test('rechecks expiry and not-before on every use', () => {
  const now = Date.now;
  try {
    Date.now = () => now() + 3*86400000;
    assert.throws(()=>inspectRuntimeCertificate(pem), /not currently valid/);
    Date.now = () => now() - 3*86400000;
    assert.throws(()=>inspectRuntimeCertificate(pem), /not currently valid/);
  } finally { Date.now = now; }
});

test('rejects unsupported EC and undersized RSA public keys', () => {
  for (const [name, options] of [['ec', ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256']], ['weak', ['-newkey', 'rsa:1024']]]) {
    const output = path.join(dir, name + '.pem');
    execFileSync('openssl', ['req', '-x509', ...options, '-nodes', '-keyout', path.join(dir, name + '-key.pem'), '-out', output, '-days', '1', '-subj', '/CN=Unsupported test key'], {stdio:'ignore'});
    assert.throws(() => inspectRuntimeCertificate(fs.readFileSync(output, 'utf8')), /RSA key of at least 2048 bits/);
  }
});
