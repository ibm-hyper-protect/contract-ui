export const getCredentialExpiry = (expiresAt) => {
  const timestamp = expiresAt ? new Date(expiresAt).getTime() : NaN;
  if (!Number.isFinite(timestamp)) {
    return { daysRemaining: null, isExpired: false, description: 'Not available' };
  }

  const remaining = timestamp - Date.now();
  const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  const isExpired = remaining <= 0;

  return {
    daysRemaining,
    isExpired,
    description: isExpired
      ? 'Expired'
      : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`,
  };
};
