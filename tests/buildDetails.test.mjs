import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILD_STATUS, ROLES } from '../src/utils/constants.js';
import { BUILD_DETAIL_STEPS, getBuildProgress } from '../src/utils/buildDetails.js';

const expectedNext = [
  [BUILD_STATUS.CREATED, 'signingKey', ROLES.AUDITOR],
  [BUILD_STATUS.SIGNING_KEY_REGISTERED, 'workload', ROLES.SOLUTION_PROVIDER],
  [BUILD_STATUS.WORKLOAD_SUBMITTED, 'environment', ROLES.DATA_OWNER],
  [BUILD_STATUS.ENVIRONMENT_STAGED, 'attestationKey', ROLES.AUDITOR],
  [BUILD_STATUS.ATTESTATION_KEY_REGISTERED, 'finalise', ROLES.AUDITOR],
  [BUILD_STATUS.FINALIZED, 'export', ROLES.ENV_OPERATOR],
];

for (const [index, [status, tab, role]] of expectedNext.entries()) {
  test(`${status}: count achieved stages and identify the next role and tab`, () => {
    const result = getBuildProgress(status);
    assert.equal(result.kind, 'active');
    assert.equal(result.completedCount, index + 1);
    assert.equal(result.currentIndex, index + 1);
    assert.equal(result.nextStep.tab, tab);
    assert.equal(result.nextStep.role, role);
    assert.equal(result.isLegacy, false);
  });
}

test('download acknowledgement completes all seven contract stages', () => {
  const result = getBuildProgress(BUILD_STATUS.CONTRACT_DOWNLOADED);
  assert.equal(result.kind, 'complete');
  assert.equal(result.completedCount, 7);
  assert.equal(result.currentIndex, BUILD_DETAIL_STEPS.length);
  assert.equal(result.nextStep, null);
});

test('cancellation does not imply a return to Created or invent a completed-stage count', () => {
  const result = getBuildProgress(BUILD_STATUS.CANCELLED);
  assert.equal(result.kind, 'cancelled');
  assert.equal(result.completedCount, null);
  assert.equal(result.currentIndex, null);
  assert.equal(result.nextStep, null);
});

for (const status of [null, undefined, '', 'FUTURE_STATUS']) {
  test(`unknown status ${JSON.stringify(status)} does not suggest an action`, () => {
    const result = getBuildProgress(status);
    assert.equal(result.kind, 'unknown');
    assert.equal(result.currentIndex, null);
    assert.equal(result.completedCount, null);
    assert.equal(result.nextStep, null);
    assert.equal(result.meta.label, 'Unknown status');
  });
}

test('legacy builds retain their label and map only to the equivalent stage', () => {
  for (const [oldStatus, equivalent] of [
    [BUILD_STATUS.AUDITOR_KEYS_REGISTERED, BUILD_STATUS.ATTESTATION_KEY_REGISTERED],
    [BUILD_STATUS.CONTRACT_ASSEMBLED, BUILD_STATUS.FINALIZED],
  ]) {
    const legacy = getBuildProgress(oldStatus);
    assert.equal(legacy.isLegacy, true);
    assert.equal(legacy.completedCount, getBuildProgress(equivalent).completedCount);
    assert.match(legacy.meta.label, /v1/);
    assert.equal(legacy.status, oldStatus);
  }
});

test('normalise status casing and surrounding whitespace', () => {
  const result = getBuildProgress('  workload_submitted  ');
  assert.equal(result.status, BUILD_STATUS.WORKLOAD_SUBMITTED);
  assert.equal(result.nextStep.tab, 'environment');
});
