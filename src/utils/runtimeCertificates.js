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

import { hasCertificateContent } from './submissionForm.js';

/**
 * Require the platform-aware API instead of guessing from a legacy flat list.
 * @param {object} data - Backend catalog response.
 * @returns {Array} Platform entries in backend order.
 */
export function parseCertificateCatalog(data) {
  const platforms = data?.platforms;
  if (!Array.isArray(platforms)) {
    throw new Error('This backend does not provide platform certificates. Update the backend or upload a custom certificate.');
  }
  const ids = new Set();
  for (const platform of platforms) {
    if (!platform || typeof platform.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(platform.id) ||
        ids.has(platform.id) || typeof platform.contract_supported !== 'boolean' ||
        !Array.isArray(platform.versions) || platform.versions.some(v => typeof v !== 'string' || !v.trim()) ||
        new Set(platform.versions).size !== platform.versions.length) {
      throw new Error('The backend returned an invalid runtime certificate catalog.');
    }
    ids.add(platform.id);
  }
  return platforms;
}

/**
 * Bind a PEM response to the exact requested choice before it can be submitted.
 * Certificate parsing and cryptographic validation remain authoritative on the backend.
 * @param {object} data - Backend certificate response.
 * @param {string} platform - Requested platform identifier.
 * @param {string} version - Requested certificate version.
 * @returns {object} Validated response with a display name.
 */
export function parseRuntimeCertificate(data, platform, version) {
  if (data?.platform !== platform || data?.version !== version ||
      typeof data?.contract_supported !== 'boolean' ||
      !hasCertificateContent(data?.certificate_pem) ||
      typeof data?.fingerprint_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.fingerprint_sha256)) {
    throw new Error('The backend returned a certificate that does not match the selected platform and version.');
  }
  const start = Date.parse(data.not_before);
  const end = Date.parse(data.not_after);
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || now < start || now >= end) {
    throw new Error('This certificate is not currently valid. Select another version or upload the certificate for your runtime.');
  }
  return { ...data, name: platform.toUpperCase() + ' · ' + version };
}
