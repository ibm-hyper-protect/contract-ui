import React, { useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import PageHeader from '../components/PageHeader';
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  ProgressIndicator,
  ProgressStep,
  Tag,
  Tile
} from '@carbon/react';
import { ArrowLeft, ArrowRight, CheckmarkFilled, WarningAlt, Information } from '@carbon/icons-react';
import BuildAssignments from '../components/BuildAssignments';
import AuditorSection from '../components/AuditorSection';
import ContractExport from '../components/ContractExport';
import SectionSubmit from '../components/SectionSubmit';
import FinaliseContract from '../components/FinaliseContract';
import AuditViewer from '../components/AuditViewer';
import AttestationEvidenceSection from '../components/AttestationEvidenceSection';
import { ROLE_NAMES } from '../utils/constants';
import { BUILD_DETAIL_STEPS, getBuildProgress } from '../utils/buildDetails';

const COMPACT_PROGRESS_QUERY = '(max-width: 1055px)';
const subscribeToCompactProgress = (onChange) => {
  const query = window.matchMedia(COMPACT_PROGRESS_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const getCompactProgress = () => window.matchMedia(COMPACT_PROGRESS_QUERY).matches;

const TAB_LABELS = {
  assignments: 'Assignments',
  signingKey: 'Add signing key',
  workload: 'Add workload',
  environment: 'Add environment',
  attestationKey: 'Add attestation key',
  finalise: 'Finalise contract',
  export: 'Export contract',
  attestationRecords: 'Attestation records',
  verifyAttestation: 'Verify attestation',
  audit: 'Audit trail'
};

const ROLE_BUILD_TAB_KEYS = {
  ADMIN: ['assignments', 'audit'],
  AUDITOR: ['assignments', 'signingKey', 'attestationKey', 'finalise', 'verifyAttestation', 'audit'],
  SOLUTION_PROVIDER: ['assignments', 'workload', 'audit'],
  DATA_OWNER: ['assignments', 'environment', 'attestationRecords', 'audit'],
  ENV_OPERATOR: ['assignments', 'export', 'attestationRecords', 'audit'],
  VIEWER: ['assignments', 'audit']
};

/**
 * BuildDetails View
 * Integrated view for build management with assignments, section submission, export, and audit
 */
const BuildDetails = ({ build, onBack, userRole, advanceBuildState }) => {
  const [selection, setSelection] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState(null);
  const tabsContainer = useRef(null);
  const verticalProgress = useSyncExternalStore(subscribeToCompactProgress, getCompactProgress);
  const currentStatus = statusUpdate && statusUpdate.buildId === build?.id && statusUpdate.sourceStatus === build?.status
    ? statusUpdate.status : build?.status;
  const progress = getBuildProgress(currentStatus);

  const handleStatusUpdate = useCallback((newStatus) => {
    if (!build?.id) return;
    setStatusUpdate({ buildId: build.id, sourceStatus: build.status, status: newStatus });
    advanceBuildState?.(build.id, newStatus);
  }, [advanceBuildState, build?.id, build?.status]);

  const tabs = useMemo(() => {
    const tabKeys = ROLE_BUILD_TAB_KEYS[userRole] || ROLE_BUILD_TAB_KEYS.VIEWER;
    return tabKeys.map((key) => ({
      key,
      label: TAB_LABELS[key] || key
    }));
  }, [userRole]);

  // Keep tab selection with its build and role, rather than reusing an index.
  const selectedTabKey = selection && selection.buildId === build?.id && selection.role === userRole
    ? selection.key : 'assignments';
  const selectedTab = Math.max(0, tabs.findIndex(tab => tab.key === selectedTabKey));
  const selectTab = (key) => setSelection({ buildId: build.id, role: userRole, key });
  const nextTabIndex = tabs.findIndex(tab => tab.key === progress.nextStep?.tab);
  const canOpenNextStep = !progress.isLegacy && progress.nextStep?.role === userRole && nextTabIndex >= 0;
  const nextRole = ROLE_NAMES[progress.nextStep?.role];

  if (!build) {
    return (
      <div className="app-page app-page--wide">
        <PageHeader title="Build details" description="Loading build details…" />
      </div>
    );
  }

  return (
    <div className="app-page app-page--wide build-details">
      <PageHeader
        className="app-page__header--flush"
        title={build.name}
        description={<>Build ID: <span className="build-details__id">{build.id}</span></>}
        actions={(
          <Button kind="tertiary" size="md" renderIcon={ArrowLeft} onClick={onBack}>
            Back to builds
          </Button>
        )}
        navigation={(
          <Breadcrumb noTrailingSlash>
            <BreadcrumbItem>
              <a href="#" onClick={(event) => { event.preventDefault(); onBack?.(); }}>
                Builds
              </a>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>{build.name}</BreadcrumbItem>
          </Breadcrumb>
        )}
      />

      <Tile className="build-details-stage" role="region" aria-label="Build progress">
        <div className="build-details-stage__header">
          <div>
            <h2 className="build-details-stage__title">Build progress</h2>
            <p className="build-details-stage__description">
              {progress.completedCount === null
                ? progress.kind === 'cancelled' ? 'This build is no longer progressing.' : 'Stage information unavailable'
                : `${progress.completedCount} of ${BUILD_DETAIL_STEPS.length} stages complete`}
            </p>
          </div>
          <div className="build-details-stage__tags">
            {progress.isLegacy && <Tag type="gray">Legacy workflow</Tag>}
            <Tag type={progress.meta.kind}>{progress.meta.label}</Tag>
          </div>
        </div>

        {progress.completedCount !== null && (
          <ProgressIndicator
            className="build-details-progress"
            currentIndex={progress.currentIndex}
            spaceEqually
            vertical={verticalProgress}
            aria-label="Contract workflow stages"
          >
            {BUILD_DETAIL_STEPS.map((step, index) => (
              <ProgressStep
                key={step.status}
                label={step.label}
                description={`${index < progress.currentIndex ? 'Completed' : index === progress.currentIndex ? 'Next step' : 'Not started'}: ${step.label}`}
                aria-current={index === progress.currentIndex ? 'step' : undefined}
                tabIndex={-1}
              />
            ))}
          </ProgressIndicator>
        )}

        {progress.nextStep ? (
          <div className="build-details-next" aria-live="polite">
            <div>
              <p className="build-details-next__label">Next step</p>
              <h3 className="build-details-next__title">{progress.nextStep.action}</h3>
              <p className="build-details-next__description">
                {progress.isLegacy
                  ? 'This build uses a legacy workflow. Review the available tabs for its supported actions.'
                  : canOpenNextStep
                  ? `Complete this step as ${nextRole}.`
                  : `Waiting for the ${nextRole} to complete this step.`}
              </p>
            </div>
            {canOpenNextStep && (
              <Button kind="primary" size="md" renderIcon={ArrowRight} onClick={() => {
                selectTab(progress.nextStep.tab);
                tabsContainer.current?.querySelector(`[data-build-tab="${progress.nextStep.tab}"]`)?.focus();
              }}>
                {progress.nextStep.action}
              </Button>
            )}
          </div>
        ) : (
          <div className="build-details-next build-details-next--terminal">
            {progress.kind === 'cancelled' ? <WarningAlt size={24} className="build-details-next__warning" />
              : progress.kind === 'complete' ? <CheckmarkFilled size={24} className="build-details-next__success" />
              : <Information size={24} />}
            <div>
              <h3 className="build-details-next__title">
                {progress.kind === 'cancelled' ? 'Build cancelled'
                  : progress.kind === 'complete' ? 'Contract workflow complete' : 'Progress unavailable'}
              </h3>
              <p className="build-details-next__description">
                {progress.kind === 'cancelled'
                  ? 'No further workflow steps are pending. You can review assignments and the audit trail below.'
                  : progress.kind === 'complete'
                    ? 'The contract was downloaded and acknowledged. Attestation records can still be reviewed in the relevant tabs.'
                    : 'The build status is not recognised. Return to the build list to refresh its status, or review the audit trail.'}
              </p>
            </div>
          </div>
        )}
      </Tile>

      {/* Tabbed Interface */}
      <div ref={tabsContainer}>
        <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => selectTab(tabs[selectedIndex].key)}>
          <TabList aria-label="Build details" contained>
            {tabs.map(t => <Tab key={t.key} data-build-tab={t.key}>{t.label}</Tab>)}
          </TabList>

          <TabPanels>
            {tabs.map(t => (
              <TabPanel key={`${build.id}:${userRole}:${t.key}`}>
                <div className="build-details-tab-content">
                  {t.key === 'assignments' && (
                    <BuildAssignments
                      buildId={build.id}
                      buildStatus={currentStatus}
                      userRole={userRole}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  )}
                  {t.key === 'signingKey' && (
                    <AuditorSection
                      buildId={build.id}
                      buildStatus={currentStatus}
                      onStatusUpdate={handleStatusUpdate}
                      mode="signing"
                    />
                  )}
                  {(t.key === 'workload' || t.key === 'environment') && (
                    <SectionSubmit
                      buildId={build.id}
                      buildStatus={currentStatus}
                      personaRole={t.key === 'workload' ? 'SOLUTION_PROVIDER' : 'DATA_OWNER'}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  )}
                  {t.key === 'attestationKey' && (
                    <AuditorSection
                      buildId={build.id}
                      buildStatus={currentStatus}
                      onStatusUpdate={handleStatusUpdate}
                      mode="attestation"
                    />
                  )}
                  {t.key === 'finalise' && (
                    <FinaliseContract
                      buildId={build.id}
                      buildStatus={currentStatus}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  )}
                  {t.key === 'export' && (
                    <ContractExport
                      buildId={build.id}
                      buildStatus={currentStatus}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  )}
                  {t.key === 'attestationRecords' && (
                    <AttestationEvidenceSection
                      buildId={build.id}
                      buildStatus={currentStatus}
                      mode="upload"
                    />
                  )}
                  {t.key === 'verifyAttestation' && (
                    <AttestationEvidenceSection
                      buildId={build.id}
                      buildStatus={currentStatus}
                      mode="verify"
                    />
                  )}
                  {t.key === 'audit' && (
                    <AuditViewer buildId={build.id} userRole={userRole} />
                  )}
                </div>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default BuildDetails;
