import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalPresence,
  Button,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
  TextInput,
  CodeSnippet,
  Tile,
  Layer,
  InlineLoading
} from '@carbon/react';
import {
  Locked,
  Unlocked,
  Renew
} from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import authService from '../services/authService';
import cryptoService from '../services/cryptoService';
import { formatDateOnly, formatFingerprint } from '../utils/formatters';
import { getCredentialExpiry } from '../utils/credentialExpiry';
import CredentialStatus from './CredentialStatus';

/**
 * PublicKeyManager Component
 * Manages RSA-4096 public key registration, display, and rotation
 * Features: Key generation, registration, expiry display, rotation workflow
 */
const PublicKeyManager = ({ userId }) => {
  const user = useAuthStore((state) => state.user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const launcherButtonRef = useRef(null);

  // Key generation state
  const [generatedKeyPair, setGeneratedKeyPair] = useState(null);
  const [keyFingerprint, setKeyFingerprint] = useState('');

  // Key info state
  const [keyInfo, setKeyInfo] = useState(null);
  const [keyInfoLoading, setKeyInfoLoading] = useState(true);
  const [keyLoadError, setKeyLoadError] = useState(null);
  const keyStatus = getCredentialExpiry(keyInfo?.expires_at);

  const targetUserId = userId || user?.id;
  const isCurrentUser = !userId || userId === user?.id;

  useEffect(() => {
    if (targetUserId) {
      loadKeyInfo();
    }
  }, [targetUserId]);

  const loadKeyInfo = async () => {
    setKeyInfoLoading(true);
    setKeyLoadError(null);
    try {
      const info = isCurrentUser
        ? await authService.getMyPublicKey()
        : await authService.getPublicKey(targetUserId);
      setKeyInfo(info);
    } catch (error) {
      setKeyInfo(null);
      if (!error.message?.includes('not registered') && error.status !== 400 && error.status !== 404) {
        setKeyLoadError('Could not load your public key. Try again to check its status.');
      }
    } finally {
      setKeyInfoLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // Generate RSA-4096 key pair
      const keyPair = await cryptoService.generateIdentityKeyPair();

      // Compute fingerprint
      const fingerprint = await cryptoService.computeFingerprint(keyPair.publicKey);

      setGeneratedKeyPair(keyPair);
      setKeyFingerprint(fingerprint);
      setCurrentStep(1);
    } catch (err) {
      setError(`Failed to generate key pair: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterKey = async () => {
    if (loading || !generatedKeyPair || currentStep !== 1) return;
    setLoading(true);
    setError(null);

    try {
      // Store private key securely
      await cryptoService.storePrivateKey(targetUserId, generatedKeyPair.privateKey);

      // Register public key with backend
      const result = isCurrentUser
        ? await authService.registerPublicKey(generatedKeyPair.publicKey)
        : await authService.registerPublicKeyForUser(targetUserId, generatedKeyPair.publicKey);

      setSuccess(`Public key registered successfully! Fingerprint: ${result.fingerprint.substring(0, 16)}...`);
      setCurrentStep(2);

      // Reload key info
      await loadKeyInfo();

      // Close modal after 2 seconds
      setTimeout(() => {
        setIsModalOpen(false);
        resetModal();
      }, 2000);
    } catch (err) {
      setError(`Failed to register public key: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setCurrentStep(0);
    setGeneratedKeyPair(null);
    setKeyFingerprint('');
    setError(null);
    setSuccess(null);
  };

  const handleOpenModal = () => {
    resetModal();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (loading) return;
    setIsModalOpen(false);
    resetModal();
  };

  return (
    <div className="public-key-manager">
      <Tile className="account-credential-panel public-key-manager__tile">
        <header className="account-credential-panel__header">
          <h2 className="account-credential-panel__title">
            {keyInfo ? <Locked size={20} aria-hidden="true" /> : <Unlocked size={20} aria-hidden="true" />}
            Public key
          </h2>
          {!keyInfoLoading && !keyLoadError && (
            <CredentialStatus registered={Boolean(keyInfo)} expiresAt={keyInfo?.expires_at} />
          )}
        </header>
        <p className="account-credential-panel__description">Manage the signing key linked to your account.</p>

        {keyInfoLoading ? (
          <InlineLoading description="Loading public key…" />
        ) : keyLoadError ? (
          <div className="public-key-manager__details">
            <InlineNotification kind="error" title="Public key unavailable" subtitle={keyLoadError} lowContrast hideCloseButton className="account-credential-panel__notification" />
            <Button kind="tertiary" renderIcon={Renew} onClick={loadKeyInfo}>Retry</Button>
          </div>
        ) : keyInfo ? (
          <Layer>
            <div className="public-key-manager__details">
              <div>
                <h3 className="public-key-manager__label">Fingerprint</h3>
                <CodeSnippet
                  type="multi"
                  wrapText
                  minCollapsedNumberOfRows={2}
                  maxCollapsedNumberOfRows={6}
                  aria-label="Public key fingerprint"
                  copyButtonDescription="Copy fingerprint"
                  feedback="Fingerprint copied"
                  className="public-key-manager__fingerprint-snippet"
                >
                  {formatFingerprint(keyInfo.fingerprint)}
                </CodeSnippet>
              </div>

              <dl className="account-credential-details account-credential-details--key">
                <div><dt>Registered</dt><dd>{formatDateOnly(keyInfo.created_at)}</dd></div>
                <div>
                  <dt>Expires</dt>
                  <dd>{formatDateOnly(keyInfo.expires_at)}<span className="account-credential-details__hint">{keyStatus.description}</span></dd>
                </div>
              </dl>

              {keyStatus.isExpired && (
                <InlineNotification
                  kind="error"
                  title="Public key expired"
                  subtitle="Rotate your key to continue signing requests."
                  lowContrast
                  hideCloseButton
                  className="account-credential-panel__notification"
                />
              )}
              {keyStatus.daysRemaining != null && keyStatus.daysRemaining <= 14 && !keyStatus.isExpired && (
                <InlineNotification
                  kind="warning"
                  title="Public key expires soon"
                  subtitle="Rotate your key before it expires to keep your account ready to use."
                  lowContrast
                  hideCloseButton
                  className="account-credential-panel__notification"
                />
              )}
              <div className="account-credential-panel__actions">
                <Button ref={launcherButtonRef} kind="tertiary" renderIcon={Renew} onClick={handleOpenModal}>Rotate key</Button>
              </div>
            </div>
          </Layer>
        ) : (
          <div className="public-key-manager__details">
            <InlineNotification
              kind="info"
              title="Register your public key"
              subtitle="Add a signing key to complete your account setup."
              lowContrast
              hideCloseButton
              className="account-credential-panel__notification"
            />
            <div className="account-credential-panel__actions">
              <Button ref={launcherButtonRef} kind="tertiary" renderIcon={Locked} onClick={handleOpenModal}>Register public key</Button>
            </div>
          </div>
        )}
      </Tile>

      <ModalPresence open={isModalOpen}>
        <Modal
          className="account-key-modal"
          open={isModalOpen}
          launcherButtonRef={launcherButtonRef}
          selectorPrimaryFocus=".cds--btn--secondary"
          onRequestClose={handleCloseModal}
          modalHeading={keyInfo ? 'Rotate public key' : 'Register public key'}
          primaryButtonText={currentStep === 1 ? 'Register key' : 'Generate key pair'}
          secondaryButtonText="Cancel"
          onRequestSubmit={currentStep === 0 ? handleGenerateKey : handleRegisterKey}
          onSecondarySubmit={handleCloseModal}
          primaryButtonDisabled={loading || currentStep === 2}
          loadingStatus={loading ? 'active' : 'inactive'}
          loadingDescription={currentStep === 0 ? 'Generating key pair…' : 'Registering public key…'}
          size="md"
        >
          <ProgressIndicator currentIndex={currentStep} spaceEqually>
            <ProgressStep
              label="Generate key pair"
              description="Create RSA-4096 key pair"
            />
            <ProgressStep
              label="Register public key"
              description="Store and register key"
            />
            <ProgressStep
              label="Complete"
              description="Key registered successfully"
            />
          </ProgressIndicator>

          <div className="public-key-manager__modal-content">
            {error && (
              <InlineNotification
                kind="error"
                title="Error"
                subtitle={error}
                onCloseButtonClick={() => setError(null)}
                lowContrast
              />
            )}

            {currentStep === 0 && (
              <div className="public-key-manager__step-content">
                <p>
                  This will generate a new RSA-4096 key pair for cryptographic operations.
                  The private key will be stored securely on your device, and the public key
                  will be registered with the server.
                </p>

                {keyInfo && (
                  <InlineNotification
                    kind="info"
                    title="Key rotation"
                    subtitle="Your existing key will be replaced. All future operations will use the new key."
                    lowContrast
                  />
                )}
              </div>
            )}

            {currentStep === 1 && generatedKeyPair && (
              <div className="public-key-manager__step-content">
                <p>Key pair generated successfully!</p>

                <div className="public-key-manager__key-info-display">
                  <TextInput
                    id="fingerprint"
                    labelText="Public key fingerprint"
                    value={formatFingerprint(keyFingerprint)}
                    readOnly
                  />

                  <InlineNotification
                    kind="info"
                    title="Secure storage"
                    subtitle="Your private key will be stored securely in your system's keychain. Never share your private key."
                    lowContrast
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="public-key-manager__step-content">
                <InlineNotification
                  kind="success"
                  title="Public key registered"
                  subtitle={success || 'Your public key is ready to use.'}
                  lowContrast
                />
              </div>
            )}
          </div>
        </Modal>
      </ModalPresence>
    </div>
  );
};

export default PublicKeyManager;
