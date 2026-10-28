import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeContractContent,
  getContractContent,
  getContractSize,
} from '../src/utils/contractContent.js';

test('raw YAML preserves whitespace, line endings, and Unicode', () => {
  const yaml = '  workload: Zürich\r\nenv: 東京\r\n';
  assert.equal(decodeContractContent(yaml), yaml);
  assert.equal(
    decodeContractContent('workload: encrypted'),
    'workload: encrypted',
  );
});

test('legacy base64 contract payloads decode as UTF-8', () => {
  const yaml = 'workload: Zürich\nenv: 東京\n';
  assert.equal(
    decodeContractContent(Buffer.from(yaml).toString('base64')),
    yaml,
  );
  assert.equal(
    getContractContent({ contract_yaml: Buffer.from(yaml).toString('base64') }),
    yaml,
  );
});

test('invalid base64 and invalid UTF-8 are not silently corrupted', () => {
  assert.equal(decodeContractContent('not base64!'), 'not base64!');
  assert.equal(decodeContractContent('/w=='), '/w==');
});

test('empty server responses cannot become a preview or a saved contract', () => {
  for (const data of [
    null,
    {},
    { contract_yaml: '' },
    { contract_yaml: ' \n' },
    { contract_yaml: 42 },
    { contract_yaml: 'IA==' },
  ]) {
    assert.throws(() => getContractContent(data), /empty contract/);
  }
  assert.equal(
    getContractContent({ user_data: 'env: fixture' }),
    'env: fixture',
  );
});

test('contract size counts UTF-8 bytes rather than JavaScript characters', () => {
  assert.equal(getContractSize('é'.repeat(512)), '1.0 KB');
  assert.equal(getContractSize('a'.repeat(1024)), '1.0 KB');
});
