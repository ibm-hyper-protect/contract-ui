import React from 'react';
import { Grid, Column, InlineNotification } from '@carbon/react';
import { useAuthStore } from '../store/authStore';
import PublicKeyManager from '../components/PublicKeyManager';
import PasswordManager from '../components/PasswordManager';

const AccountSettings = () => {
  const { user, isSetupRequired, getSetupPending } = useAuthStore();
  const setupPending = getSetupPending();
  const setupActions = setupPending.map((step) => ({
    password_change: 'change your password',
    public_key_registration: 'register a public key',
  }[step] || step.replaceAll('_', ' ')));

  return (
    <div className="app-page app-page--wide account-settings">
      <header className="account-settings__header">
        <h1 className="account-settings__title">Account settings</h1>
        <p className="account-settings__subtitle">Manage your password and signing key.</p>
      </header>

      {isSetupRequired() && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title="Complete your account setup"
          subtitle={`To continue, ${setupActions.join(' and ')}.`}
          className="account-settings-notification"
        />
      )}

      <Grid fullWidth className="account-settings-grid">
        <Column lg={8} md={8} sm={4} className="account-settings-grid__column">
          <PasswordManager requiresUpdate={setupPending.includes('password_change')} />
        </Column>
        <Column lg={8} md={8} sm={4} className="account-settings-grid__column">
          <PublicKeyManager userId={user?.id} />
        </Column>
      </Grid>
    </div>
  );
};

export default AccountSettings;
