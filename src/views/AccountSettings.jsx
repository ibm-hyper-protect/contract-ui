import React from 'react';
import { Grid, Column, InlineNotification } from '@carbon/react';
import { useAuthStore } from '../store/authStore';
import PublicKeyManager from '../components/PublicKeyManager';
import PasswordManager from '../components/PasswordManager';
import PageHeader from '../components/PageHeader';

const AccountSettings = () => {
  const { user, isSetupRequired, getSetupPending } = useAuthStore();
  const setupPending = getSetupPending();
  const setupActions = setupPending.map((step) => ({
    password_change: 'change your password',
    public_key_registration: 'register a public key',
  }[step] || step.replaceAll('_', ' ')));

  return (
    <div className="app-page app-page--wide account-settings">
      <PageHeader
        title="Account settings"
        description="Manage your password and signing key."
      />

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
