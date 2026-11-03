import { BUILD_STATUS, BUILD_STATUS_CONFIG, ROLES } from './constants.js';

export const BUILD_DETAIL_STEPS = [
  { status: BUILD_STATUS.CREATED, label: 'Created' },
  { status: BUILD_STATUS.SIGNING_KEY_REGISTERED, label: 'Signing key', action: 'Add signing key', role: ROLES.AUDITOR, tab: 'signingKey' },
  { status: BUILD_STATUS.WORKLOAD_SUBMITTED, label: 'Workload', action: 'Add workload', role: ROLES.SOLUTION_PROVIDER, tab: 'workload' },
  { status: BUILD_STATUS.ENVIRONMENT_STAGED, label: 'Environment', action: 'Add environment', role: ROLES.DATA_OWNER, tab: 'environment' },
  { status: BUILD_STATUS.ATTESTATION_KEY_REGISTERED, label: 'Attestation key', action: 'Add attestation key', role: ROLES.AUDITOR, tab: 'attestationKey' },
  { status: BUILD_STATUS.FINALIZED, label: 'Finalised', action: 'Finalise contract', role: ROLES.AUDITOR, tab: 'finalise' },
  { status: BUILD_STATUS.CONTRACT_DOWNLOADED, label: 'Downloaded', action: 'Export contract', role: ROLES.ENV_OPERATOR, tab: 'export' },
];

const LEGACY_STAGES = {
  [BUILD_STATUS.AUDITOR_KEYS_REGISTERED]: BUILD_STATUS.ATTESTATION_KEY_REGISTERED,
  [BUILD_STATUS.CONTRACT_ASSEMBLED]: BUILD_STATUS.FINALIZED,
};

/** Backend statuses describe completed stages; highlight the next unfinished step. */
export const getBuildProgress = (value) => {
  const status = String(value ?? '').trim().toUpperCase();
  const canonicalStatus = LEGACY_STAGES[status] || status;
  const stageIndex = BUILD_DETAIL_STEPS.findIndex(step => step.status === canonicalStatus);
  const kind = status === BUILD_STATUS.CANCELLED ? 'cancelled'
    : stageIndex < 0 ? 'unknown'
    : canonicalStatus === BUILD_STATUS.CONTRACT_DOWNLOADED ? 'complete' : 'active';

  return {
    kind,
    status,
    meta: BUILD_STATUS_CONFIG[status] || { label: 'Unknown status', kind: 'gray' },
    isLegacy: Object.hasOwn(LEGACY_STAGES, status),
    completedCount: stageIndex < 0 ? null : stageIndex + 1,
    currentIndex: stageIndex < 0 ? null : stageIndex + 1,
    nextStep: kind === 'active' ? BUILD_DETAIL_STEPS[stageIndex + 1] : null,
  };
};
