import { FILE_SIZE_LIMITS } from './constants.js';

export function validateSubmissionFile(file, kind) {
  const yaml = kind === 'yaml';
  if (!(yaml ? /\.(yaml|yml)$/i : /\.(pem|crt|cer)$/i).test(file.name)) {
    return yaml ? 'Choose a .yaml or .yml file.' : 'Choose a .pem, .crt, or .cer file.';
  }
  if (!file.size) return 'This file is empty.';
  if (file.size > (yaml ? FILE_SIZE_LIMITS.WORKLOAD : FILE_SIZE_LIMITS.CERTIFICATE)) {
    return yaml
      ? 'YAML files must be 50 MB or smaller.'
      : 'Certificate files must be 10 KB or smaller.';
  }
  return '';
}

export function validateSubmissionYaml(content) {
  if (!content.trim()) return 'Add YAML content before continuing.';
  if (new TextEncoder().encode(content).byteLength > FILE_SIZE_LIMITS.WORKLOAD)
    return 'YAML content must be 50 MB or smaller.';
  return '';
}

// Check PEM framing only. Certificate validity and YAML schema are checked by the backend.
export function hasCertificateContent(content) {
  return (
    typeof content === 'string' &&
    !content.includes('PASTE_') &&
    /-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=]+(?:\s+[A-Za-z0-9+/=]+)*\s+-----END CERTIFICATE-----/.test(
      content
    )
  );
}
