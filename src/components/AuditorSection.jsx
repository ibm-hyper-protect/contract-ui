import React, { useEffect, useMemo, useRef, useState } from 'react';
import ContractInputHelp from './ContractInputHelp';
import {
  Button,
  InlineNotification,
  Tag,
  Tile,
  PasswordInput,
  RadioButtonGroup,
  RadioButton,
  FileUploader,
} from '@carbon/react';
import {
  Key,
  Certificate,
} from '@carbon/icons-react';
import buildService from '../services/buildService';
import ConfirmDialog from './ConfirmDialog';
import LoadingState from './LoadingState';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import RuntimeCertificateSelect from './RuntimeCertificateSelect';
import { hasCertificateContent, validateSubmissionFile } from '../utils/submissionForm';

/** Maps build status strings → Carbon Tag type for semantic colour coding */
const STATUS_TAG_TYPE = {
  CREATED:                    'blue',
  SIGNING_KEY_REGISTERED:     'cyan',
  WORKLOAD_SUBMITTED:         'cyan',
  ENVIRONMENT_STAGED:         'teal',
  ATTESTATION_KEY_REGISTERED: 'teal',
  FINALIZED:                  'green',
  CONTRACT_DOWNLOADED:        'green',
  CANCELLED:                  'gray',
  FAILED:                     'red',
  AUDITOR_KEYS_REGISTERED:    'purple',
};
const statusTagType = (s) => STATUS_TAG_TYPE[(s || '').toUpperCase()] || 'blue';

const TERMINAL_STATUSES = new Set(['FINALIZED', 'CONTRACT_DOWNLOADED', 'CANCELLED']);
const SIGNING_REGISTERED_STATUSES = new Set([
  'SIGNING_KEY_REGISTERED',
  'WORKLOAD_SUBMITTED',
  'ENVIRONMENT_STAGED',
  'ATTESTATION_KEY_REGISTERED',
  'FINALIZED',
  'CONTRACT_DOWNLOADED',
  'CANCELLED',
  // Legacy v1 state retained in DB for older builds.
  'AUDITOR_KEYS_REGISTERED',
]);
const ATTESTATION_REGISTERED_STATUSES = new Set([
  'ATTESTATION_KEY_REGISTERED',
  'FINALIZED',
  'CONTRACT_DOWNLOADED',
  'CANCELLED',
  // Legacy v1 state retained in DB for older builds.
  'AUDITOR_KEYS_REGISTERED',
]);

const AuditorSection = ({ buildId, buildStatus: buildStatusProp, onStatusUpdate, mode = 'combined' }) => {
  const [liveStatus, setLiveStatus] = useState(buildStatusProp || '');
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [signingResult, setSigningResult] = useState(null);
  const [attestationResult, setAttestationResult] = useState(null);
  const [signingPassphrase, setSigningPassphrase] = useState('');
  const [attestationPassphrase, setAttestationPassphrase] = useState('');
  
  // Certificate source: 'builtin' | 'custom'
  const [certSource, setCertSource] = useState('custom');
  const [runtimeCertificate, setRuntimeCertificate] = useState(null);
  const [customCertContent, setCustomCertContent] = useState('');
  const [customCertFileName, setCustomCertFileName] = useState('');
  const [readingCertificate, setReadingCertificate] = useState(false);
  const certificateRequest = useRef(0);
  const certificateUploader = useRef(null);

  useEffect(() => () => { ++certificateRequest.current; }, []);

  const [registeringSigning, setRegisteringSigning] = useState(false);
  const [registeringAttestation, setRegisteringAttestation] = useState(false);
  const [confirmRegisterSigningOpen, setConfirmRegisterSigningOpen] = useState(false);
  const [confirmRegisterAttestationOpen, setConfirmRegisterAttestationOpen] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const isSigningMode = mode === 'signing';
  const isAttestationMode = mode === 'attestation';
  const showSigningCard = !isAttestationMode;
  const showAttestationCards = !isSigningMode;

  const signingKeyID = useMemo(
    () => signingResult?.signing_key_id || signingResult?.key_id || '',
    [signingResult]
  );
  const attestationKeyID = useMemo(
    () => attestationResult?.attestation_key_id || attestationResult?.key_id || '',
    [attestationResult]
  );

  const liveStatusUpper = (liveStatus || '').toUpperCase();
  const isTerminal = TERMINAL_STATUSES.has(liveStatusUpper);
  const isSigningRegistered = Boolean(signingKeyID) || SIGNING_REGISTERED_STATUSES.has(liveStatusUpper);
  const isAttestationRegistered = Boolean(attestationKeyID) || ATTESTATION_REGISTERED_STATUSES.has(liveStatusUpper);
  const canRegisterAttestation = ['ENVIRONMENT_STAGED', 'ATTESTATION_KEY_REGISTERED', 'FINALIZED', 'CONTRACT_DOWNLOADED']
    .includes(liveStatusUpper);

  const pageTitle = isSigningMode
    ? 'Add Signing Key'
    : isAttestationMode
      ? 'Add attestation key'
      : 'Sign & Add Attestation';
  const pageDescription = isSigningMode
    ? 'Register a build-scoped signing key for this build.'
    : isAttestationMode
      ? 'Register a build-scoped attestation key for this build.'
      : 'Register signing and attestation keys using backend-native v2 endpoints.';
  const attestationStepLabel = showSigningCard ? 'Step 2' : 'Step 1';
  
  const getActiveCertContent = () =>
    certSource === 'custom' ? customCertContent : runtimeCertificate?.certificate_pem || '';

  const refreshBuildStatus = async () => {
    const build = await buildService.getBuild(buildId);
    const status = build?.status || '';
    setLiveStatus(status);
    onStatusUpdate?.(status);
  };

  useEffect(() => {
    setLiveStatus(buildStatusProp || '');
  }, [buildStatusProp]);

  useEffect(() => {
    const load = async () => {
      try {
        await refreshBuildStatus();
      } catch (_) {
        // no-op
      } finally {
        setLoadingStatus(false);
      }
    };

    load();
  }, [buildId]);

  const handleRegisterSigningKey = () => {
    setError(null);
    setSuccess(null);

    if (isSigningRegistered) {
      setSuccess('Signing key is already registered for this build.');
      return;
    }

    if (!signingPassphrase.trim()) {
      setError('Signing key passphrase is required.');
      return;
    }

    setConfirmRegisterSigningOpen(true);
  };

  const confirmRegisterSigningKey = async () => {
    setConfirmRegisterSigningOpen(false);
    setError(null);
    setSuccess(null);

    if (isSigningRegistered) {
      setSuccess('Signing key is already registered for this build.');
      return;
    }

    if (!signingPassphrase.trim()) {
      setError('Signing key passphrase is required.');
      return;
    }

    setRegisteringSigning(true);
    try {
      const result = await buildService.registerSigningKey(buildId, {
        mode: 'generate',
        passphrase: signingPassphrase.trim()
      });
      setSigningResult(result);
      const nextSigningKeyID = result?.signing_key_id || result?.key_id || '';
      await refreshBuildStatus();
      if (result?.passphrase_ignored) {
        setSuccess('Signing key registered successfully. The backend ignored the optional passphrase field.');
      } else {
        setSuccess(isSigningMode
          ? 'Signing key registered successfully.'
          : 'Signing key registered successfully.');
      }
    } catch (err) {
      setError(`Failed to register signing key: ${err.message}`);
    } finally {
      setRegisteringSigning(false);
    }
  };

  const clearCustomCertificate = () => {
    ++certificateRequest.current;
    setCustomCertContent('');
    setCustomCertFileName('');
    setReadingCertificate(false);
  };

  const handleCustomCertUpload = async (e) => {
    clearCustomCertificate();
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateSubmissionFile(file, 'certificate');
    if (validationError) {
      certificateUploader.current?.clearFiles();
      setError(validationError);
      return;
    }
    const request = certificateRequest.current;
    setReadingCertificate(true);
    try {
      const content = await file.text();
      if (request !== certificateRequest.current) return;
      if (!hasCertificateContent(content)) {
        certificateUploader.current?.clearFiles();
        setError('Choose a PEM certificate with BEGIN CERTIFICATE and END CERTIFICATE markers.');
        return;
      }
      setCustomCertContent(content);
      setCustomCertFileName(file.name);
    } catch {
      if (request === certificateRequest.current) {
        certificateUploader.current?.clearFiles();
        setError('Unable to read this file. Please choose it again.');
      }
    } finally {
      if (request === certificateRequest.current) setReadingCertificate(false);
    }
  };

  const handleRegisterAttestationKey = () => {
    if (readingCertificate) return;
    setError(null);
    setSuccess(null);

    if (isAttestationRegistered) {
      setSuccess('Attestation key is already registered for this build.');
      return;
    }

    if (!attestationPassphrase.trim()) {
      setError('Attestation key passphrase is required.');
      return;
    }

    const certContent = getActiveCertContent();
    if (!certContent || certContent.trim() === '') {
      setError('Please select or upload a valid encryption certificate.');
      return;
    }
    if (!hasCertificateContent(certContent)) {
      setError('Upload a PEM encryption certificate for your runtime.');
      return;
    }

    setConfirmRegisterAttestationOpen(true);
  };

  const confirmRegisterAttestationKey = async () => {
    if (readingCertificate) return;
    setConfirmRegisterAttestationOpen(false);
    setError(null);
    setSuccess(null);

    if (isAttestationRegistered) {
      setSuccess('Attestation key is already registered for this build.');
      return;
    }

    if (!attestationPassphrase.trim()) {
      setError('Attestation key passphrase is required.');
      return;
    }

    const certContent = getActiveCertContent();
    if (!certContent || certContent.trim() === '') {
      setError('Please select or upload a valid encryption certificate.');
      return;
    }
    if (!hasCertificateContent(certContent)) {
      setError('Upload a PEM encryption certificate for your runtime.');
      return;
    }

    setRegisteringAttestation(true);
    try {
      const result = await buildService.registerAttestationKey(buildId, {
        mode: 'generate',
        passphrase: attestationPassphrase.trim(),
        encryption_cert_pem: certContent
      });
      setAttestationResult(result);
      const nextAttestationKeyID = result?.attestation_key_id || result?.key_id || '';
      await refreshBuildStatus();
      setSuccess('Attestation key registered successfully. The public key has been encrypted.');
    } catch (err) {
      setError(`Failed to register attestation key: ${err.message}`);
    } finally {
      setRegisteringAttestation(false);
    }
  };

  return (
    <div>
      <h2 className="workflow-title">{pageTitle}</h2>
      <p className="workflow-description">
        {pageDescription}
      </p>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
          className="workflow-notification"
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={success}
          onCloseButtonClick={() => setSuccess(null)}
          lowContrast
          className="workflow-notification"
        />
      )}

      {loadingStatus && <LoadingState variant="key-material" description="Loading build key status…" size="inline" />}

      {!loadingStatus && (
        <Tile className="workflow-complete-tile">
          <div className="workflow-complete-tile__row">
            <strong className="workflow-complete-tile__label">Current Build Status</strong>
            <Tag type={statusTagType(liveStatus)} className="workflow-complete-tile__tag">
              {liveStatus || 'UNKNOWN'}
            </Tag>
          </div>
        </Tile>
      )}

      <ContractInputHelp section="keys" />
      <div className={`workflow-body${isTerminal ? ' workflow-body--disabled' : ''}`}>
        {showSigningCard && (
          <div className="workflow-step-card">
            <h4 className="workflow-step-heading">
              <Key size={18} className="workflow-step-heading__icon" />
              <span>Step 1 — Register Signing Key</span>
              {isSigningRegistered && <Tag type="green" size="sm">Done</Tag>}
            </h4>
            <p className="workflow-step-copy">
              Registers a build-scoped signing key for this build.
            </p>
            <PasswordInput
              id="signing-key-passphrase"
              labelText="Signing Key Passphrase"
              placeholder="Enter passphrase"
              helperText="Leading and trailing whitespace is ignored."
              value={signingPassphrase}
              onChange={(e) => setSigningPassphrase(e.target.value)}
              autoComplete="new-password"
              disabled={registeringSigning || isTerminal || isSigningRegistered}
            />
            <PasswordStrengthMeter password={signingPassphrase.trim()} />
            {signingKeyID && (
              <p className="workflow-step-copy">
                Signing Key ID: <code>{signingKeyID}</code>
              </p>
            )}
            {isSigningRegistered && !signingKeyID && (
              <p className="workflow-step-copy">
                Signing key is already registered for this build.
              </p>
            )}
            <div className="workflow-inline-actions workflow-inline-actions--spaced">
              <Button
                kind="primary"
                onClick={handleRegisterSigningKey}
                disabled={registeringSigning || isTerminal || isSigningRegistered}
              >
                {registeringSigning ? 'Registering...' : (isSigningRegistered ? 'Signing Key Registered' : 'Register Signing Key')}
              </Button>
              {registeringSigning && (
                <LoadingState variant="signature-trace" description="Registering signing key…" size="inline" />
              )}
            </div>
          </div>
        )}

        {showAttestationCards && (
          <div className={`workflow-step-card${canRegisterAttestation ? '' : ' workflow-step-card--blocked'}`}>
            <h4 className="workflow-step-heading">
              <Certificate size={18} />
              {attestationStepLabel} — Register Attestation Key
              {attestationKeyID && <Tag type="green" size="sm">Done</Tag>}
              {!canRegisterAttestation && !isAttestationRegistered && <Tag type="gray" size="sm">Wait for ENVIRONMENT_STAGED</Tag>}
            </h4>
            <p className="workflow-step-copy">
              Registers a build-scoped attestation key via <code>POST /builds/{'{id}'}/keys/attestation</code>.
            </p>
            {attestationKeyID && (
              <p className="workflow-step-copy">
                Attestation Key ID: <code>{attestationKeyID}</code>
              </p>
            )}
            <PasswordInput
              id="attestation-key-passphrase"
              labelText="Attestation Key Passphrase"
              placeholder="Enter passphrase"
              helperText="Leading and trailing whitespace is ignored."
              value={attestationPassphrase}
              onChange={(e) => setAttestationPassphrase(e.target.value)}
              autoComplete="new-password"
              disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
            />
            
            <PasswordStrengthMeter password={attestationPassphrase.trim()} />
            
            <div style={{ marginTop: '1rem' }}>
              <h5 className="workflow-step-title" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Runtime encryption certificate
              </h5>
              <p className="workflow-step-copy">
                The attestation public key will be encrypted using this certificate before storage.
              </p>
              
              <RadioButtonGroup
                name="attestation-cert-source"
                valueSelected={certSource}
                onChange={(val) => { clearCustomCertificate(); setRuntimeCertificate(null); setCertSource(val); }}
                className="workflow-radio-group"
                disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
              >
                <RadioButton
                  labelText="Upload custom certificate"
                  value="custom"
                  id="attestation-cert-custom"
                  disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                />
                <RadioButton
                  labelText="Choose platform and version"
                  value="builtin"
                  id="attestation-cert-builtin"
                  disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                />
              </RadioButtonGroup>
              {certSource === 'builtin' ? (
                <RuntimeCertificateSelect
                  key={buildId}
                  id="attestation-runtime-certificate"
                  disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                  onChange={setRuntimeCertificate}
                />
              ) : (
                <div style={{ marginTop: '1rem' }}>
                  <FileUploader
                    ref={certificateUploader}
                    labelDescription="Upload a PEM certificate (.crt / .pem / .cer), up to 10 KB."
                    buttonLabel="Choose file"
                    filenameStatus="edit"
                    iconDescription="Remove certificate file"
                    accept={['.crt', '.pem', '.cer']}
                    onChange={handleCustomCertUpload}
                    onDelete={() => { clearCustomCertificate(); setError(null); }}
                    disabled={registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
                  />
                  {customCertFileName && (
                    <p className="workflow-upload-meta">
                      {customCertFileName} loaded
                    </p>
                  )}
                  {readingCertificate && <p className="workflow-upload-meta" role="status">Reading certificate…</p>}
                </div>
              )}
            </div>
            {isAttestationRegistered && !attestationKeyID && (
              <p className="workflow-step-copy">
                Attestation key is already registered for this build.
              </p>
            )}
            <Button
              kind="secondary"
              className="workflow-attestation-submit"
              onClick={handleRegisterAttestationKey}
              disabled={readingCertificate || registeringAttestation || !canRegisterAttestation || isTerminal || isAttestationRegistered}
            >
              {registeringAttestation ? 'Registering...' : (isAttestationRegistered ? 'Attestation Key Registered' : 'Register Attestation Key')}
            </Button>
            {registeringAttestation && (
              <LoadingState variant="key-material" description="Registering attestation key…" size="inline" />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRegisterSigningOpen}
        title="Register Signing Key"
        type="warning"
        primaryButtonText={registeringSigning ? 'Registering...' : 'Register'}
        secondaryButtonText="Cancel"
        onConfirm={confirmRegisterSigningKey}
        onCancel={() => setConfirmRegisterSigningOpen(false)}
        loading={registeringSigning}
      >
        <div>
          <p className="confirm-dialog__paragraph">
            Register a signing key for this build now?
          </p>
          <p className="confirm-dialog__note">
            Keep this passphrase available. You will need to enter it again when finalising the contract.
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRegisterAttestationOpen}
        title="Register Attestation Key"
        type="warning"
        primaryButtonText={registeringAttestation ? 'Registering...' : 'Register'}
        secondaryButtonText="Cancel"
        onConfirm={confirmRegisterAttestationKey}
        onCancel={() => setConfirmRegisterAttestationOpen(false)}
        loading={registeringAttestation}
      >
        <div>
          <p className="confirm-dialog__paragraph">
            Register an attestation key for this build now?
          </p>
          <p className="confirm-dialog__note">
            Keep this passphrase available for later protected operations. It will not be retained in session storage.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default AuditorSection;
