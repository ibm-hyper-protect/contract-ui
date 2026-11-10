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

const { X509Certificate } = require('node:crypto');

/** Inspect one public RSA certificate; trust in its source remains the user's decision. */
function inspectRuntimeCertificate(pem) {
  if (typeof pem !== 'string' || Buffer.byteLength(pem) > 10240 ||
      !/^\s*-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----\s*$/.test(pem)) {
    throw new Error('Provide one public PEM certificate, without private keys or a certificate chain.');
  }
  let certificate;
  try { certificate = new X509Certificate(pem); }
  catch { throw new Error('The runtime certificate is not a valid X.509 certificate.'); }
  if (certificate.publicKey.asymmetricKeyType !== 'rsa' || certificate.publicKey.asymmetricKeyDetails.modulusLength < 2048) {
    throw new Error('The runtime certificate needs an RSA key of at least 2048 bits.');
  }
  if (Date.now() < Date.parse(certificate.validFrom) || Date.now() >= Date.parse(certificate.validTo)) {
    throw new Error('The runtime certificate is not currently valid. Upload a current certificate for your target runtime.');
  }
  return {
    content: certificate.toString(), subject: certificate.subject,
    fingerprint: certificate.fingerprint256,
    notBefore: certificate.validFrom, notAfter: certificate.validTo,
  };
}

module.exports = { inspectRuntimeCertificate };
