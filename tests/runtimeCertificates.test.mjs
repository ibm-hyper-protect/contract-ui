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
import { parseCertificateCatalog, parseRuntimeCertificate } from '../src/utils/runtimeCertificates.js';

const certificate = (overrides = {}) => ({
  platform: 'ccrt',
  version: '26.7.2',
  contract_supported: true,
  certificate_pem: '-----BEGIN CERTIFICATE-----\nVEVTVC1GUkFNSU5HLU9OTFk=\n-----END CERTIFICATE-----',
  fingerprint_sha256: 'a'.repeat(64),
  not_before: new Date(Date.now() - 3600000).toISOString(),
  not_after: new Date(Date.now() + 3600000).toISOString(),
  ...overrides,
});

test('catalog retains backend identifiers, version ownership and contract support', () => {
  const platforms = [
    { id: 'ccrt', versions: ['26.7.2', '26.5.0'], contract_supported: true },
    { id: 'hpvs', versions: ['1.0.29'], contract_supported: false },
  ];
  assert.deepEqual(parseCertificateCatalog({ platforms }), platforms);
  assert.deepEqual(parseCertificateCatalog({ platforms: [] }), []);
  assert.deepEqual(parseCertificateCatalog({ platforms: [{ id: 'ccrt', versions: [], contract_supported: true }] })[0].versions, []);
});

test('legacy or malformed catalog cannot silently supply fabricated choices', () => {
  for (const data of [
    null, { versions: ['26.7.2'] }, { platforms: null },
    { platforms: [{ id: 'ccrt', versions: ['26.7.2'] }] },
    { platforms: [{ id: '../cert', versions: [], contract_supported: true }] },
    { platforms: [{ id: 'ccrt', versions: [''], contract_supported: true }] },
    { platforms: [{ id: 'ccrt', versions: ['26.7.2', '26.7.2'], contract_supported: true }] },
    { platforms: [null] },
    { platforms: Array(2).fill({ id: 'ccrt', versions: [], contract_supported: true }) },
  ]) assert.throws(() => parseCertificateCatalog(data));
});

test('certificate response is bound to the exact choice and retains genuine metadata', () => {
  const data = certificate();
  assert.deepEqual(parseRuntimeCertificate(data, 'ccrt', '26.7.2'), { ...data, name: 'CCRT · 26.7.2' });
  const unsupported = certificate({ platform: 'hpvs', version: '1.0.29', contract_supported: false });
  assert.equal(parseRuntimeCertificate(unsupported, 'hpvs', '1.0.29').contract_supported, false);
  assert.throws(() => parseRuntimeCertificate(data, 'ccrv', '26.7.2'), /does not match/);
  assert.throws(() => parseRuntimeCertificate(data, 'ccrt', '26.5.0'), /does not match/);
});

test('invalid PEM, fingerprint, support flags and validity cannot reach a submission', () => {
  for (const overrides of [
    { certificate_pem: '' }, { certificate_pem: 'not a PEM certificate' },
    { fingerprint_sha256: 'bad' }, { contract_supported: 'true' },
    { not_before: 'invalid' }, { not_after: 'invalid' },
    { not_before: new Date(Date.now() + 7200000).toISOString() },
    { not_after: new Date(Date.now() - 1000).toISOString() },
    { not_after: new Date(Date.now() - 7200000).toISOString() },
  ]) assert.throws(() => parseRuntimeCertificate(certificate(overrides), 'ccrt', '26.7.2'));
  assert.throws(() => parseRuntimeCertificate(null, 'ccrt', '26.7.2'));
});
