import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  CodeSnippet,
  InlineLoading,
  InlineNotification,
  Layer,
  Modal,
  ModalPresence,
  PasswordInput,
  Tag,
  TextInput,
  Tile
} from '@carbon/react';
import { Add, Locked, Renew, TrashCan } from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import userKeyService, {
  isActiveKey,
  keyStatus,
  normalizeFingerprint
} from '../services/userKeyService';
import cryptoService from '../services/cryptoService';
import { formatDateOnly, formatFingerprint } from '../utils/formatters';
import { getCredentialExpiry } from '../utils/credentialExpiry';
import CredentialStatus from './CredentialStatus';
import { useToast } from './ToastManager';

/** Account key history and this device's signing identity. Admins can revoke, never register for another user. */
const PublicKeyManager = ({ userId }) => {
  const currentUser = useAuthStore((state) => state.user);
  const targetId = userId || currentUser?.id;
  const isOwner = targetId === currentUser?.id;
  const { showSuccess } = useToast();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const actionLock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = isOwner
        ? await userKeyService.refresh(targetId)
        : { keys: await userKeyService.list(targetId), local: null };
      setSnapshot(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [targetId, isOwner]);

  useEffect(() => {
    setSnapshot(null);
    setModal(null);
    if (targetId) load().catch(() => {});
  }, [targetId, load]);

  const run = async (operation) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (err) {
      setError(
        err.message ||
          'Could not complete the key operation. Refresh and try again.'
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
      setPassword('');
      setConfirmation('');
    }
  };

  const close = () => {
    if (actionLock.current) return;
    setModal(null);
    setPassword('');
    setConfirmation('');
  };
  const open = (value) => {
    setPassword('');
    setConfirmation('');
    setError(null);
    setModal(value);
  };
  const keys = snapshot?.keys || [];
  const local = snapshot?.local;
  const active = keys.filter(isActiveKey);
  const current = active.find(
    (key) =>
      normalizeFingerprint(key.fingerprint) === local?.active?.fingerprint
  );
  const needsTransfer = isOwner && active.length > 0 && !current;
  const pendingRegistered = keys.some(
    (key) =>
      normalizeFingerprint(key.fingerprint) === local?.pending?.fingerprint
  );

  const prepare = () =>
    run(async () => {
      const fresh = await load();
      if (fresh.keys.filter(isActiveKey).length >= 5)
        throw new Error('Revoke an unused key before adding another.');
      await cryptoService.prepareIdentityKey(targetId);
      await load();
      setLabel('');
      open({ type: 'register' });
    });

  const submit = () =>
    run(async () => {
      if (modal.type === 'register') {
        await userKeyService.register({ label, password });
        setModal(null);
        await load();
        showSuccess(
          'Device key registered',
          'This device now signs with the new key. Other keys remain active until revoked.'
        );
      } else if (modal.type === 'revoke') {
        await userKeyService.revoke(targetId, modal.key.id);
        setModal(null);
        await load();
        showSuccess(
          'Key revoked',
          'This key can no longer authorize requests.'
        );
      } else if (modal.type === 'discard') {
        await userKeyService.discardPending(targetId);
        setModal(null);
        await load();
      } else if (modal.type === 'export') {
        if (await cryptoService.exportIdentityBackup(targetId, password)) {
          setModal(null);
          showSuccess(
            'Encrypted backup saved',
            'Transfer it securely and share the passphrase separately.'
          );
        }
      } else if (modal.type === 'import') {
        const imported = await cryptoService.importIdentityBackup(
          targetId,
          password
        );
        if (!imported) return;
        const refreshed = await load();
        setModal(null);
        if (refreshed.local.active?.fingerprint !== imported.fingerprint) {
          throw new Error(
            'This backup is not an active key for this account. Discard the pending key and use a valid backup.'
          );
        }
        showSuccess(
          'Key imported',
          'Register a new device key next so each device has its own identity.'
        );
      }
    });

  const modalType = modal?.type;
  const headings = {
    register: 'Register device key',
    revoke: 'Revoke device key',
    discard: 'Discard pending key',
    export: 'Export encrypted device key',
    import: 'Import encrypted device key'
  };
  const buttons = {
    register: 'Register key',
    revoke: 'Revoke key',
    discard: 'Discard key',
    export: 'Save backup',
    import: 'Choose backup'
  };
  const transfer = modalType === 'export' || modalType === 'import';
  const blocked =
    busy ||
    (modalType === 'register' &&
      (label.trim().length > 100 || (keys.length > 0 && !password))) ||
    (transfer &&
      (password.length < 12 ||
        (modalType === 'export' && password !== confirmation)));

  return (
    <Tile className="account-credential-panel public-key-manager public-key-manager__tile">
      <header className="account-credential-panel__header">
        <h2 className="account-credential-panel__title">
          <Locked size={20} aria-hidden="true" />
          Device keys
        </h2>
        {isOwner && snapshot && (
          <CredentialStatus
            registered={Boolean(current)}
            expiresAt={current?.expires_at}
          />
        )}
      </header>
      <p className="account-credential-panel__description">
        Each device signs with its own RSA-4096 key. Up to five keys can be
        active for 90 days each.
      </p>
      {loading && <InlineLoading description="Loading device keys…" />}
      {error && !modal && (
        <InlineNotification
          kind="error"
          title="Device key operation failed"
          subtitle={error}
          lowContrast
          hideCloseButton
        />
      )}
      {!loading && !snapshot && (
        <Button kind="tertiary" onClick={() => load().catch(() => {})}>
          Retry
        </Button>
      )}
      {snapshot && (
        <Layer>
          <p>{active.length} of 5 active keys</p>
          {isOwner && !current && (
            <InlineNotification
              kind="warning"
              title="This device cannot sign requests"
              subtitle={
                active.length
                  ? 'Import an encrypted backup of an active key from a trusted device. If none is available, ask an administrator to revoke all active keys for recovery.'
                  : 'Register a new key for this device. Confirm your current password if this account has key history.'
              }
              lowContrast
              hideCloseButton
            />
          )}
          {current && getCredentialExpiry(current.expires_at).daysRemaining <= 14 && (
            <InlineNotification
              kind="warning"
              title="This device key expires soon"
              subtitle="Register a replacement, then revoke the old key."
              lowContrast
              hideCloseButton
            />
          )}
          {local?.pending && (
            <InlineNotification
              kind="info"
              title="A pending key is saved on this device"
              subtitle="Resume registration or refresh to recover a registration whose response was lost. Your previous signing key is preserved."
              lowContrast
              hideCloseButton
            />
          )}
          <div className="device-keys__actions">
            {isOwner && !local?.pending && (
              <Button
                kind="tertiary"
                renderIcon={Add}
                disabled={
                  busy || loading || needsTransfer || active.length >= 5
                }
                onClick={prepare}
              >
                Register device key
              </Button>
            )}
            {isOwner && local?.pending && (
              <>
                <Button
                  kind="tertiary"
                  disabled={
                    busy || loading || needsTransfer || pendingRegistered
                  }
                  onClick={() => open({ type: 'register' })}
                >
                  Resume registration
                </Button>
                <Button
                  kind="ghost"
                  disabled={busy || loading}
                  onClick={() => open({ type: 'discard' })}
                >
                  Discard pending key
                </Button>
              </>
            )}
            {isOwner && (
              <Button
                kind="ghost"
                disabled={busy || loading || !!local?.pending}
                onClick={() => open({ type: 'import' })}
              >
                Import backup
              </Button>
            )}
            {isOwner && current && (
              <Button
                kind="ghost"
                disabled={busy || loading}
                onClick={() => open({ type: 'export' })}
              >
                Export encrypted backup
              </Button>
            )}
            <Button
              kind="ghost"
              renderIcon={Renew}
              disabled={busy || loading}
              onClick={() => load().catch(() => {})}
            >
              Refresh
            </Button>
          </div>
          {keys.length === 0 ? (
            <p>No keys have been registered.</p>
          ) : (
            <ul className="device-keys__list">
              {keys.map((key) => {
                const fingerprint = normalizeFingerprint(key.fingerprint);
                const isLocal =
                  isOwner && fingerprint === local?.active?.fingerprint;
                const status = keyStatus(key);
                const stored = local?.fingerprints.includes(fingerprint);
                return (
                  <li key={key.id} className="device-keys__item">
                    <div className="device-keys__heading">
                      <h3>{key.label || 'Unnamed device'}</h3>
                      <Tag
                        type={
                          status === 'Active'
                            ? 'green'
                            : status === 'Revoked'
                              ? 'gray'
                              : 'red'
                        }
                      >
                        {status}
                      </Tag>
                      {isLocal && <Tag type="blue">This device</Tag>}
                    </div>
                    <CodeSnippet
                      type="multi"
                      wrapText
                      aria-label={`Fingerprint for ${key.label || 'unnamed device'}`}
                      copyButtonDescription="Copy fingerprint"
                    >
                      {formatFingerprint(key.fingerprint)}
                    </CodeSnippet>
                    <dl className="device-keys__dates">
                      <div>
                        <dt>Registered</dt>
                        <dd>{formatDateOnly(key.registered_at)}</dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{formatDateOnly(key.expires_at)}</dd>
                      </div>
                      <div>
                        <dt>Last used</dt>
                        <dd>
                          {key.last_used_at
                            ? formatDateOnly(key.last_used_at)
                            : 'Never'}
                        </dd>
                      </div>
                      {key.revoked_at && (
                        <div>
                          <dt>Revoked</dt>
                          <dd>{formatDateOnly(key.revoked_at)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="device-keys__actions">
                      {isOwner && stored && !isLocal && isActiveKey(key) && (
                        <Button
                          kind="tertiary"
                          size="sm"
                          disabled={busy || loading}
                          onClick={() =>
                            run(async () => {
                              await userKeyService.useLocalKey(
                                targetId,
                                fingerprint
                              );
                              await load();
                            })
                          }
                        >
                          Use on this device
                        </Button>
                      )}
                      {!key.revoked_at && (
                        <Button
                          kind="danger--ghost"
                          size="sm"
                          renderIcon={TrashCan}
                          disabled={busy || loading || (isOwner && !current)}
                          onClick={() => open({ type: 'revoke', key, isLocal })}
                        >
                          Revoke key
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Layer>
      )}
      <ModalPresence open={Boolean(modal)}>
        <Modal
          className="account-key-modal"
          open={Boolean(modal)}
          modalHeading={headings[modalType] || ''}
          primaryButtonText={buttons[modalType] || 'Continue'}
          secondaryButtonText="Cancel"
          onRequestClose={close}
          onSecondarySubmit={close}
          onRequestSubmit={submit}
          primaryButtonDisabled={blocked}
          danger={modalType === 'revoke' || modalType === 'discard'}
          preventCloseOnClickOutside
        >
          {error && (
            <InlineNotification
              kind="error"
              title="Could not complete operation"
              subtitle={error}
              lowContrast
              hideCloseButton
            />
          )}
          {busy && <InlineLoading description="Processing device key…" />}
          {modalType === 'register' && (
            <div className="device-keys__form">
              <p>
                The private key is already saved on this device. It will be used
                only after the server confirms registration. Existing keys stay
                active until you revoke them.
              </p>
              <TextInput
                id="device-key-label"
                labelText="Device name (optional)"
                placeholder="Work laptop"
                value={label}
                maxLength={100}
                disabled={busy}
                onChange={(event) => setLabel(event.target.value)}
              />
              <CodeSnippet
                type="multi"
                wrapText
                copyButtonDescription="Copy pending fingerprint"
              >
                {formatFingerprint(local?.pending?.fingerprint || '')}
              </CodeSnippet>
              {keys.length > 0 && (
                <PasswordInput
                  id="device-key-password"
                  labelText="Current account password"
                  autoComplete="current-password"
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </div>
          )}
          {modalType === 'revoke' && (
            <p>
              Revoke “{modal.key.label || 'Unnamed device'}” (
              {modal.key.fingerprint.slice(0, 16)}…)?{' '}
              {modal.isLocal
                ? 'This device will no longer be able to sign requests. Register or select another local key first if you want to keep using this device.'
                : 'The device using this key will no longer be able to sign requests.'}{' '}
              Key history and existing audit signatures remain available.
            </p>
          )}
          {modalType === 'discard' && (
            <p>
              The server will be checked before the pending key is discarded. A
              confirmed active registration is recovered instead. Your previous
              signing key stays available.
            </p>
          )}
          {transfer && (
            <div className="device-keys__form">
              <p>
                {modalType === 'export'
                  ? 'Use a separate passphrase of at least 12 characters. Transfer the encrypted file securely to your other device and share the passphrase separately. Anyone with both can use this account’s key.'
                  : 'Choose a backup exported by a trusted device for this account. The key must still be active on the server. After import, register a new key for this device.'}
              </p>
              <PasswordInput
                id="device-backup-passphrase"
                labelText="Backup passphrase"
                autoComplete={modalType === 'export' ? 'new-password' : 'off'}
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
              {modalType === 'export' && (
                <PasswordInput
                  id="device-backup-confirm"
                  labelText="Confirm backup passphrase"
                  autoComplete="new-password"
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              )}
            </div>
          )}
        </Modal>
      </ModalPresence>
    </Tile>
  );
};

export default PublicKeyManager;
