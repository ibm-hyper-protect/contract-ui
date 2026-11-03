import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  CodeSnippet,
  FileUploaderDropContainer,
  FileUploaderItem,
  InlineLoading,
  InlineNotification,
  Layer,
  Modal,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Tag,
  TextArea,
  Tile,
} from '@carbon/react';
import { ArrowRight, CheckmarkFilled, DocumentAdd, Edit, Renew, View } from '@carbon/icons-react';
import sectionService from '../services/sectionService';
import buildService from '../services/buildService';
import { PLATFORMS, getCertsByPlatform, getCertById } from '../data/builtinCerts';
import { BUILD_STATUS, BUILD_STATUS_CONFIG, FILE_SIZE_LIMITS } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import {
  hasCertificateContent,
  validateSubmissionFile,
  validateSubmissionYaml,
} from '../utils/submissionForm';
import AuditorSection from './AuditorSection';

const ROLE_CONFIG = {
  SOLUTION_PROVIDER: {
    label: 'Workload',
    fileLabel: 'workload',
    templateType: 'workload',
    requiredStatus: BUILD_STATUS.SIGNING_KEY_REGISTERED,
    prerequisite: 'The auditor must register a signing key before you can add the workload.',
  },
  DATA_OWNER: {
    label: 'Environment',
    fileLabel: 'environment',
    templateType: 'env',
    requiredStatus: BUILD_STATUS.WORKLOAD_SUBMITTED,
    prerequisite:
      'The solution provider must submit the workload before you can add the environment.',
  },
};

function SubmissionSummary({ yamlName, certificateName, statusLabel }) {
  return (
    <dl className="submission-summary">
      {[
        ['YAML file', yamlName || 'Not added'],
        ['Encryption certificate', certificateName || 'Not selected'],
        ['Build stage', statusLabel],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SubmissionForm({ buildId, buildStatus, personaRole, onStatusUpdate }) {
  const config = ROLE_CONFIG[personaRole];
  const [liveStatus, setLiveStatus] = useState(buildStatus);
  const [existingSection, setExistingSection] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [contextError, setContextError] = useState('');
  const [error, setError] = useState('');
  const [yaml, setYaml] = useState({ name: '', content: '' });
  const [certificate, setCertificate] = useState({ name: '', content: '' });
  const [yamlError, setYamlError] = useState('');
  const [certificateError, setCertificateError] = useState('');
  const [certSource, setCertSource] = useState('custom');
  const [platformId, setPlatformId] = useState(PLATFORMS[0].id);
  const [certId, setCertId] = useState(getCertsByPlatform(PLATFORMS[0].id)[0]?.id || '');
  const [draft, setDraft] = useState(null);
  const [draftError, setDraftError] = useState('');
  const [reading, setReading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const contextRequest = useRef(0);
  const fileRequest = useRef(0);
  const templateRequest = useRef(0);
  const mounted = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setLiveStatus(buildStatus);
  }, [buildStatus]);

  const loadContext = useCallback(async () => {
    const request = ++contextRequest.current;
    setLoading(true);
    setContextError('');
    try {
      const [section, build] = await Promise.all([
        sectionService.getSection(buildId, personaRole),
        buildService.getBuild(buildId),
      ]);
      if (request !== contextRequest.current) return;
      setExistingSection(section);
      setLiveStatus(build?.status || '');
      setLoaded(true);
      return build?.status;
    } catch (err) {
      if (request === contextRequest.current)
        setContextError(err.message || 'Unable to load submission status.');
    } finally {
      if (request === contextRequest.current) setLoading(false);
    }
  }, [buildId, personaRole]);

  useEffect(() => {
    mounted.current = true;
    loadContext();
    return () => {
      mounted.current = false;
      ++contextRequest.current;
      ++fileRequest.current;
      ++templateRequest.current;
    };
  }, [loadContext]);

  const submitted = existingSection || receipt;
  const correctStage = liveStatus === config.requiredStatus;
  const locked = !loaded || loading || !!contextError || !correctStage || !!submitted;
  const busy = submitting || reading || loadingTemplate;
  const disabled = locked || busy;
  const activeCertificate =
    certSource === 'custom' ? certificate.content : getCertById(certId)?.cert || '';
  const certificateName =
    certSource === 'custom' ? certificate.name : getCertById(certId)?.label || '';
  const hasYaml = !!yaml.content.trim();
  const hasCertificate = hasCertificateContent(activeCertificate);
  const ready = hasYaml && hasCertificate && !locked;
  const statusLabel = BUILD_STATUS_CONFIG[liveStatus]?.label || 'Unknown stage';
  const summary = { yamlName: yaml.name, certificateName, statusLabel };

  const openEditor = (content = yaml.content, name = yaml.name || `${config.fileLabel}.yaml`) => {
    setDraft({ content, name });
    setDraftError('');
  };

  const readFile = async (file, kind) => {
    if (!file || disabled) return;
    const setFieldError = kind === 'yaml' ? setYamlError : setCertificateError;
    const validationError = validateSubmissionFile(file, kind);
    setFieldError(validationError);
    if (validationError) return;
    const request = ++fileRequest.current;
    setReading(true);
    try {
      const content = await file.text();
      if (request !== fileRequest.current) return;
      if (kind === 'yaml') {
        const message = validateSubmissionYaml(content);
        if (message) setYamlError(message);
        else openEditor(content, file.name);
      } else if (!hasCertificateContent(content)) {
        setCertificateError(
          'Choose a PEM certificate with BEGIN CERTIFICATE and END CERTIFICATE markers.'
        );
      } else {
        setCertificate({ name: file.name, content });
      }
    } catch {
      if (request === fileRequest.current)
        setFieldError('Unable to read this file. Please choose it again.');
    } finally {
      if (request === fileRequest.current) setReading(false);
    }
  };

  const useTemplate = async () => {
    const request = ++templateRequest.current;
    setLoadingTemplate(true);
    setYamlError('');
    try {
      const result = await buildService.getContractTemplate(config.templateType);
      if (request !== templateRequest.current) return;
      const content = typeof result?.content === 'string' ? result.content : '';
      const message = validateSubmissionYaml(content);
      if (message) setYamlError(message);
      else openEditor(content, `${config.fileLabel}-template.yaml`);
    } catch (err) {
      if (request === templateRequest.current)
        setYamlError(`Unable to load the template: ${err.message}`);
    } finally {
      if (request === templateRequest.current) setLoadingTemplate(false);
    }
  };

  const applyDraft = () => {
    if (disabled || !draft) return;
    const message = validateSubmissionYaml(draft.content);
    setDraftError(message);
    if (message) return;
    setYaml(draft);
    setYamlError('');
    setDraft(null);
  };

  const submit = async () => {
    if (!ready || busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const payload = { plaintext: yaml.content, certificate_pem: activeCertificate };
      const result =
        personaRole === 'SOLUTION_PROVIDER'
          ? await buildService.submitWorkloadV2(buildId, payload)
          : await buildService.submitEnvironmentV2(buildId, payload);
      if (!mounted.current) return;
      // Keep a successful POST locked even if the following status refresh fails.
      setReceipt({
        section_hash: result?.section_hash || result?.sectionHash || '',
        submitted_at: result?.submitted_at,
      });
      setReviewOpen(false);
      const status = await loadContext();
      if (mounted.current && status) onStatusUpdate?.(status);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Unable to submit. Please try again.');
    } finally {
      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <section className="submission-form" aria-labelledby={`submission-title-${personaRole}`}>
      <header className="submission-form__header">
        <div>
          <h2 id={`submission-title-${personaRole}`}>Add {config.fileLabel}</h2>
          <p>Add your YAML and choose the certificate used to encrypt it.</p>
        </div>
        <Tag type={submitted ? 'green' : ready ? 'blue' : 'gray'}>
          {submitted
            ? 'Submitted'
            : loading
              ? 'Checking status'
              : ready
                ? 'Ready to submit'
                : correctStage
                  ? 'Inputs needed'
                  : 'Waiting for previous stage'}
        </Tag>
      </header>
      {loading && <InlineLoading description="Loading submission status…" />}
      {contextError && (
        <div className="submission-form__notice">
          <InlineNotification
            kind={submitted ? 'warning' : 'error'}
            title={
              submitted ? 'Submitted — status refresh failed' : 'Unable to load submission status'
            }
            subtitle={contextError}
            lowContrast
            hideCloseButton
          />
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Renew}
            onClick={loadContext}
            disabled={loading}
          >
            Retry loading
          </Button>
        </div>
      )}
      {submitted ? (
        <Tile className="submission-form__complete">
          <CheckmarkFilled size={24} className="submission-form__complete-icon" />
          <h3>{config.label} submitted</h3>
          <p>Your {config.fileLabel} has been encrypted and saved to this build.</p>
          {submitted.submitted_at && (
            <p className="submission-form__meta">
              Submitted{' '}
              {formatDate(submitted.submitted_at, { second: '2-digit', timeZoneName: 'short' })}
            </p>
          )}
          {(submitted.section_hash || receipt?.section_hash) && (
            <>
              <p className="submission-form__meta">Encrypted payload hash (SHA-256)</p>
              <CodeSnippet type="multi" wrapText>
                {submitted.section_hash || receipt.section_hash}
              </CodeSnippet>
            </>
          )}
          {submitted.encrypted_payload && (
            <Button kind="ghost" size="sm" renderIcon={View} onClick={() => setPreviewOpen(true)}>
              View encrypted payload
            </Button>
          )}
        </Tile>
      ) : loaded && liveStatus === BUILD_STATUS.CANCELLED ? (
        <Tile className="submission-form__complete">
          <h3>Build cancelled</h3>
          <p>This build is closed and cannot accept a {config.fileLabel} submission.</p>
        </Tile>
      ) : loaded ? (
        <>
          {!correctStage && (
            <InlineNotification
              kind="info"
              title="Waiting for the previous stage"
              subtitle={config.prerequisite}
              lowContrast
              hideCloseButton
            />
          )}
          <Layer
            as="fieldset"
            className="submission-form__layout"
            disabled={disabled}
            aria-label={`${config.label} submission`}
          >
            <div className="submission-form__inputs">
              <Tile className="submission-form__step">
                <p className="submission-form__eyebrow">Step 1</p>
                <h3>{config.label} YAML</h3>
                <p className="submission-form__help">
                  Upload a .yaml or .yml file, start with a template, or paste your YAML. Maximum
                  file size: 50 MB.
                </p>
                <FileUploaderDropContainer
                  id={`yaml-file-${personaRole}`}
                  accept={['.yaml', '.yml']}
                  labelText="Drag and drop YAML here or click to upload"
                  disabled={disabled}
                  maxFileSize={FILE_SIZE_LIMITS.WORKLOAD}
                  onAddFiles={(_, { addedFiles }) => readFile(addedFiles[0], 'yaml')}
                />
                <div className="submission-form__actions">
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={DocumentAdd}
                    disabled={disabled}
                    onClick={useTemplate}
                  >
                    {loadingTemplate ? 'Loading template…' : 'Use template'}
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Edit}
                    disabled={disabled}
                    onClick={() => openEditor()}
                  >
                    {hasYaml ? 'Edit YAML' : 'Paste YAML'}
                  </Button>
                </div>
                {yaml.name && (
                  <FileUploaderItem
                    name={yaml.name}
                    status="edit"
                    iconDescription="Remove YAML file"
                    disabled={disabled}
                    onDelete={() => {
                      setYaml({ name: '', content: '' });
                      setYamlError('');
                    }}
                  />
                )}
                {yamlError && (
                  <InlineNotification
                    kind="error"
                    title="YAML could not be added"
                    subtitle={yamlError}
                    lowContrast
                    hideCloseButton
                  />
                )}
              </Tile>
              <Tile className="submission-form__step">
                <p className="submission-form__eyebrow">Step 2</p>
                <h3>Encryption certificate</h3>
                <p className="submission-form__help">
                  Choose the HPCR certificate for the environment where this contract will run.
                </p>
                <RadioButtonGroup
                  name={`cert-source-${personaRole}`}
                  legendText="Certificate source"
                  orientation="vertical"
                  valueSelected={certSource}
                  disabled={disabled}
                  onChange={(value) => {
                    setCertSource(value);
                    setCertificateError('');
                  }}
                >
                  <RadioButton
                    id={`cert-custom-${personaRole}`}
                    value="custom"
                    labelText="Upload custom certificate"
                  />
                  <RadioButton
                    id={`cert-builtin-${personaRole}`}
                    value="builtin"
                    labelText="Use built-in certificate"
                  />
                </RadioButtonGroup>
                {certSource === 'custom' ? (
                  <div className="submission-form__certificate">
                    <p className="submission-form__help">
                      PEM-encoded .pem, .crt, or .cer file. Maximum file size: 10 KB.
                    </p>
                    <FileUploaderDropContainer
                      id={`certificate-file-${personaRole}`}
                      accept={['.pem', '.crt', '.cer']}
                      labelText="Drag and drop a certificate here or click to upload"
                      disabled={disabled}
                      maxFileSize={FILE_SIZE_LIMITS.CERTIFICATE}
                      onAddFiles={(_, { addedFiles }) => readFile(addedFiles[0], 'certificate')}
                    />
                    {certificate.name && (
                      <FileUploaderItem
                        name={certificate.name}
                        status="edit"
                        iconDescription="Remove certificate file"
                        disabled={disabled}
                        onDelete={() => {
                          setCertificate({ name: '', content: '' });
                          setCertificateError('');
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="submission-form__certificate submission-form__selects">
                    <Select
                      id={`platform-${personaRole}`}
                      labelText="Platform"
                      value={platformId}
                      disabled={disabled}
                      onChange={(event) => {
                        setPlatformId(event.target.value);
                        setCertId(getCertsByPlatform(event.target.value)[0]?.id || '');
                      }}
                    >
                      {PLATFORMS.filter((platform) => getCertsByPlatform(platform.id).length).map(
                        (platform) => (
                          <SelectItem key={platform.id} value={platform.id} text={platform.label} />
                        )
                      )}
                    </Select>
                    <Select
                      id={`certificate-${personaRole}`}
                      labelText="Certificate"
                      value={certId}
                      disabled={disabled}
                      onChange={(event) => setCertId(event.target.value)}
                    >
                      {getCertsByPlatform(platformId).map((cert) => (
                        <SelectItem
                          key={cert.id}
                          value={cert.id}
                          text={cert.version || cert.label}
                        />
                      ))}
                    </Select>
                  </div>
                )}
                {certificateError && (
                  <InlineNotification
                    kind="error"
                    title="Certificate could not be added"
                    subtitle={certificateError}
                    lowContrast
                    hideCloseButton
                  />
                )}
                {reading && <InlineLoading description="Reading file…" />}
              </Tile>
            </div>
            <Tile className="submission-form__step submission-form__review">
              <p className="submission-form__eyebrow">Step 3</p>
              <h3>Review and submit</h3>
              <p className="submission-form__help">
                The server encrypts your YAML with the selected certificate and stores the encrypted
                payload.
              </p>
              <SubmissionSummary {...summary} />
              <p className="submission-form__readiness" aria-live="polite">
                {!correctStage
                  ? 'Complete the previous build stage to continue.'
                  : !hasYaml
                    ? 'Add your YAML to continue.'
                    : !hasCertificate
                      ? 'Choose an encryption certificate to continue.'
                      : 'Your inputs are ready to review.'}
              </p>
              <Button
                renderIcon={ArrowRight}
                disabled={!ready || busy}
                onClick={() => {
                  setError('');
                  setReviewOpen(true);
                }}
              >
                Review submission
              </Button>
            </Tile>
          </Layer>
        </>
      ) : null}
      <Modal
        open={!!draft}
        modalHeading={`Edit ${config.fileLabel} YAML`}
        modalLabel={draft?.name}
        className="submission-modal"
        size="lg"
        primaryButtonText="Apply YAML"
        secondaryButtonText="Cancel"
        primaryButtonDisabled={disabled || !draft?.content.trim()}
        onRequestSubmit={applyDraft}
        onRequestClose={() => setDraft(null)}
        onSecondarySubmit={() => setDraft(null)}
        selectorPrimaryFocus={`#yaml-editor-${personaRole}`}
      >
        <TextArea
          id={`yaml-editor-${personaRole}`}
          labelText={`${config.label} YAML content`}
          rows={16}
          value={draft?.content || ''}
          onChange={(event) => {
            setDraft((current) => ({ ...current, content: event.target.value }));
            setDraftError('');
          }}
          invalid={!!draftError}
          invalidText={draftError}
          spellCheck={false}
        />
      </Modal>
      <Modal
        open={reviewOpen}
        modalHeading={`Submit ${config.fileLabel}`}
        modalLabel="Review submission"
        className="submission-modal"
        size="lg"
        loadingStatus={submitting ? 'active' : 'inactive'}
        loadingDescription="Submitting…"
        primaryButtonText={submitting ? 'Submitting…' : `Submit ${config.fileLabel}`}
        secondaryButtonText="Back to editing"
        primaryButtonDisabled={!ready || busy}
        onRequestSubmit={submit}
        onRequestClose={() => {
          if (!submitting) setReviewOpen(false);
        }}
        onSecondarySubmit={() => {
          if (!submitting) setReviewOpen(false);
        }}
        preventCloseOnClickOutside
      >
        <p className="submission-form__help">
          Check your YAML and certificate before submitting. Once submitted, this section cannot be
          edited.
        </p>
        {error && (
          <InlineNotification
            kind="error"
            title="Submission failed"
            subtitle={error}
            lowContrast
            hideCloseButton
          />
        )}
        <SubmissionSummary {...summary} />
        <h3 className="submission-form__preview-title">{config.label} YAML</h3>
        <CodeSnippet type="multi" wrapText>
          {yaml.content}
        </CodeSnippet>
      </Modal>
      <Modal
        open={previewOpen}
        passiveModal
        modalHeading={`Encrypted ${config.fileLabel}`}
        modalLabel="Submitted payload"
        className="submission-modal"
        size="lg"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <CodeSnippet type="multi" wrapText>
          {submitted?.encrypted_payload || ''}
        </CodeSnippet>
      </Modal>
    </section>
  );
}

export default function SectionSubmit(props) {
  if (props.personaRole === 'AUDITOR') return <AuditorSection {...props} />;
  if (!ROLE_CONFIG[props.personaRole]) return null;
  // A draft belongs to one role on one build and must never leak to another.
  return <SubmissionForm key={`${props.buildId}:${props.personaRole}`} {...props} />;
}
