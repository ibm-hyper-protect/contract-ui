import React, { useRef, useState } from 'react';
import { Tile, Layer, Stack, PasswordInput, Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Locked } from '@carbon/icons-react';
import authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { formatDateOnly } from '../utils/formatters';
import { getCredentialExpiry } from '../utils/credentialExpiry';
import CredentialStatus from './CredentialStatus';
import { PasswordStrengthMeter, isPasswordValid } from './PasswordStrengthMeter';

const PasswordManager = ({ requiresUpdate = false }) => {
  const user = useAuthStore((state) => state.user);
  const lastPasswordChange = useAuthStore((state) => state.lastPasswordChange || state.user?.password_changed_at);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const submitting = useRef(false);

  const changedAt = lastPasswordChange ? new Date(lastPasswordChange) : null;
  const fallbackExpiry = changedAt && Number.isFinite(changedAt.getTime())
    ? new Date(changedAt.getTime()) : null;
  fallbackExpiry?.setDate(fallbackExpiry.getDate() + 90);
  const expiresAt = user?.password_expires_at || fallbackExpiry?.toISOString();
  const expiry = getCredentialExpiry(expiresAt);
  const passwordMismatch = confirmTouched && confirmPassword !== newPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setNotification(null);
    setConfirmTouched(true);

    if (newPassword !== confirmPassword || !isPasswordValid(newPassword)) return;

    submitting.current = true;
    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setNotification({ kind: 'success', title: 'Password changed', subtitle: 'Use your new password the next time you sign in.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setConfirmTouched(false);
    } catch (error) {
      setNotification({ kind: 'error', title: 'Could not change password', subtitle: error.message || 'Try again. Your existing password is still in use.' });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Tile className="account-credential-panel password-manager__tile">
      <header className="account-credential-panel__header">
        <h2 className="account-credential-panel__title"><Locked size={20} aria-hidden="true" />Password</h2>
        <CredentialStatus expiresAt={expiresAt} requiresUpdate={requiresUpdate} />
      </header>
      <p className="account-credential-panel__description">Update the password you use to sign in.</p>

      <dl className="account-credential-details">
        <div><dt>Last changed</dt><dd>{formatDateOnly(lastPasswordChange)}</dd></div>
        <div>
          <dt>Expires</dt>
          <dd>{formatDateOnly(expiresAt)}<span className="account-credential-details__hint">{expiry.description}</span></dd>
        </div>
      </dl>

      <Layer>
        <form onSubmit={handleSubmit} aria-label="Change password" aria-busy={isSubmitting}>
          <Stack gap={5}>
            <PasswordInput
              id="current-password"
              name="current-password"
              labelText="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
            <div>
              <PasswordInput
                id="new-password"
                name="new-password"
                labelText="New password"
                autoComplete="new-password"
                helperText="Use at least 12 characters, with uppercase and lowercase letters, a number, and a special character (@$!%*?&)."
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={12}
                disabled={isSubmitting}
                required
              />
              <PasswordStrengthMeter password={newPassword} showCriteria={false} />
            </div>
            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              labelText="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onBlur={() => setConfirmTouched(true)}
              invalid={passwordMismatch}
              invalidText="Passwords do not match. Enter your new password again."
              disabled={isSubmitting}
              required
            />
            {notification && (
              <InlineNotification
                kind={notification.kind}
                title={notification.title}
                subtitle={notification.subtitle}
                lowContrast
                onCloseButtonClick={() => setNotification(null)}
                className="account-credential-panel__notification"
              />
            )}
            <div className="account-credential-panel__actions">
              <Button type="submit" kind="primary" disabled={isSubmitting || !currentPassword || !isPasswordValid(newPassword) || newPassword !== confirmPassword}>
                Change password
              </Button>
              {isSubmitting && <InlineLoading description="Updating password…" />}
            </div>
          </Stack>
        </form>
      </Layer>
    </Tile>
  );
};

export default PasswordManager;
