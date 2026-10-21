const DAY = 24 * 60 * 60 * 1000;
export const CREDENTIAL_WARNING_DAYS = 30;

export const CREDENTIAL_STATUS = {
  expired: { label: 'Expired', type: 'red' },
  required: { label: 'Update required', type: 'warm-gray' },
  missing: { label: 'Not registered', type: 'warm-gray' },
  unknown: { label: 'Expiry unavailable', type: 'gray' },
  soon: { label: 'Expiring soon', type: 'warm-gray' },
  active: { label: 'Active', type: 'green' },
};

const needsAttention = new Set(['expired', 'required', 'missing', 'unknown']);

/** Use the same enabled-user snapshot for the overview and credential review. */
export const getCredentialHealth = (users, now = Date.now()) => {
  const credentials = users.filter(user => user.is_active).flatMap(user => (
    ['password', 'key'].map(kind => {
      const expiresAt = kind === 'password' ? user.password_expires_at : user.public_key_expires_at;
      const timestamp = expiresAt && !expiresAt.startsWith('0001-') ? new Date(expiresAt).getTime() : NaN;
      const daysRemaining = Number.isFinite(timestamp) ? Math.ceil((timestamp - now) / DAY) : null;
      let status = 'active';
      if (kind === 'key' && !user.public_key_fingerprint) status = 'missing';
      else if (kind === 'password' && user.must_change_password) status = 'required';
      else if (daysRemaining === null) status = 'unknown';
      else if (timestamp <= now) status = 'expired';
      else if (timestamp - now <= CREDENTIAL_WARNING_DAYS * DAY) status = 'soon';
      return {
        id: `${user.id}:${kind}`,
        userId: user.id,
        name: user.name || user.full_name || user.email,
        email: user.email,
        kind,
        expiresAt: status !== 'missing' && Number.isFinite(timestamp) ? expiresAt : null,
        daysRemaining: status === 'missing' ? null : daysRemaining,
        status,
        needsAttention: needsAttention.has(status),
      };
    })
  ));
  const attention = credentials.filter(item => item.needsAttention);
  const expiring = credentials.filter(item => item.status === 'soon');
  return {
    credentials,
    attentionUsers: new Set(attention.map(item => item.userId)).size,
    attentionPasswords: attention.filter(item => item.kind === 'password').length,
    attentionKeys: attention.filter(item => item.kind === 'key').length,
    expiringUsers: new Set(expiring.map(item => item.userId)).size,
  };
};
