import React from 'react';
import { Tag } from '@carbon/react';
import { CheckmarkFilled, ErrorFilled, WarningAlt } from '@carbon/icons-react';
import { getCredentialExpiry } from '../utils/credentialExpiry';

const CredentialStatus = ({ expiresAt, registered = true, requiresUpdate = false }) => {
  const expiry = getCredentialExpiry(expiresAt);
  let status = { type: 'gray', label: 'Status unavailable' };

  if (!registered) {
    status = { type: 'gray', label: 'Not registered' };
  } else if (expiry.isExpired) {
    status = { type: 'red', label: 'Expired', icon: ErrorFilled };
  } else if (requiresUpdate) {
    status = { type: 'warm-gray', label: 'Update required', icon: WarningAlt };
  } else if (expiry.daysRemaining != null) {
    status = expiry.daysRemaining <= 14
      ? { type: 'warm-gray', label: 'Expiring soon', icon: WarningAlt }
      : { type: 'green', label: 'Active', icon: CheckmarkFilled };
  }

  return <Tag type={status.type} renderIcon={status.icon} size="sm">{status.label}</Tag>;
};

export default CredentialStatus;
