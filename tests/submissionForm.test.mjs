import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasCertificateContent,
  validateSubmissionFile,
  validateSubmissionYaml,
} from '../src/utils/submissionForm.js';
import { FILE_SIZE_LIMITS } from '../src/utils/constants.js';

test('YAML uploads accept both extensions and enforce the existing size limit', () => {
  for (const name of ['workload.yaml', 'ENV.YML']) {
    assert.equal(validateSubmissionFile({ name, size: FILE_SIZE_LIMITS.WORKLOAD }, 'yaml'), '');
  }
  assert.match(
    validateSubmissionFile({ name: 'workload.yaml', size: FILE_SIZE_LIMITS.WORKLOAD + 1 }, 'yaml'),
    /50 MB/
  );
  assert.match(validateSubmissionFile({ name: 'workload.txt', size: 1 }, 'yaml'), /\.yaml/);
  assert.match(validateSubmissionFile({ name: 'workload.yaml', size: 0 }, 'yaml'), /empty/);
});

test('certificate uploads accept PEM file extensions and enforce 10 KB', () => {
  for (const name of ['hpcr.pem', 'hpcr.CRT', 'hpcr.cer']) {
    assert.equal(
      validateSubmissionFile({ name, size: FILE_SIZE_LIMITS.CERTIFICATE }, 'certificate'),
      ''
    );
  }
  assert.match(
    validateSubmissionFile(
      { name: 'hpcr.pem', size: FILE_SIZE_LIMITS.CERTIFICATE + 1 },
      'certificate'
    ),
    /10 KB/
  );
  assert.match(validateSubmissionFile({ name: 'private.key', size: 1 }, 'certificate'), /\.pem/);
});

test('pasted YAML cannot bypass empty content and byte size checks', () => {
  assert.match(validateSubmissionYaml(' \n\t '), /Add YAML/);
  assert.equal(validateSubmissionYaml('workload:\n  name: café\n'), '');
  assert.match(validateSubmissionYaml('é'.repeat(FILE_SIZE_LIMITS.WORKLOAD / 2 + 1)), /50 MB/);
});

test('certificate framing rejects empty, incomplete and template placeholder inputs', () => {
  assert.equal(
    hasCertificateContent('-----BEGIN CERTIFICATE-----\nZml4dHVyZQ==\n-----END CERTIFICATE-----'),
    true
  );
  for (const content of [
    null,
    '',
    '-----BEGIN CERTIFICATE-----',
    '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
    '-----BEGIN CERTIFICATE-----\nPASTE_CERTIFICATE_HERE\n-----END CERTIFICATE-----',
  ]) {
    assert.equal(hasCertificateContent(content), false);
  }
});
