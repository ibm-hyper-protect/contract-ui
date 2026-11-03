import apiClient from './apiClient';
import cryptoService from './cryptoService';
import { useAuthStore } from '../store/authStore';

export const normalizeFingerprint = (value = '') =>
  value.replace(/:/g, '').toLowerCase();
export const isActiveKey = (key) =>
  Boolean(
    key && !key.revoked_at && new Date(key.expires_at).getTime() > Date.now()
  );
export const keyStatus = (key) =>
  key.revoked_at ? 'Revoked' : isActiveKey(key) ? 'Active' : 'Expired';

class UserKeyService {
  refreshGeneration = new Map();
  async list(userId) {
    const { data } = await apiClient.get(`/users/${userId}/public-keys`);
    if (!Array.isArray(data.keys))
      throw new Error('The server returned an invalid key list.');
    return data.keys;
  }

  /** Recover a confirmed candidate after a lost response or interrupted local activation. */
  async refresh(userId) {
    const generation = (this.refreshGeneration.get(userId) || 0) + 1;
    this.refreshGeneration.set(userId, generation);
    const session = useAuthStore.getState().token;
    const server = apiClient.getBaseURL();
    const keys = await this.list(userId);
    const initialLocal = await cryptoService.getIdentityKeyInfo(userId);
    let local = initialLocal;
    const confirmed = keys.find(
      (key) =>
        normalizeFingerprint(key.fingerprint) === local.pending?.fingerprint
    );
    if (isActiveKey(confirmed)) {
      await cryptoService.activateIdentityKey(
        userId,
        local.pending.fingerprint
      );
      local = await cryptoService.getIdentityKeyInfo(userId);
    }
    if (
      useAuthStore.getState().user?.id === userId &&
      useAuthStore.getState().token === session &&
      apiClient.getBaseURL() === server &&
      this.refreshGeneration.get(userId) === generation
    ) {
      const current = keys.find(
        (key) =>
          normalizeFingerprint(key.fingerprint) === local.active?.fingerprint
      );
      useAuthStore.getState().setIdentityKeys(keys, current || null);
    }
    return { keys, local };
  }

  /** Recheck history immediately before registration; never replace a working key on failure. */
  async register({ label, password }) {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('Please log in again.');
    const { keys, local } = await this.refresh(userId);
    // Refresh may have recovered a registration whose response was lost.
    if (!local.pending) return { recovered: true };
    const active = keys.filter(isActiveKey);
    if (active.length >= 5)
      throw new Error(
        'Five keys are active. Revoke an unused key before adding another.'
      );
    if (keys.length && !password)
      throw new Error('Confirm your current password.');
    const current = active.find(
      (key) =>
        normalizeFingerprint(key.fingerprint) === local.active?.fingerprint
    );
    if (active.length && !current) {
      throw new Error(
        'Import an active key from a trusted device, or ask an administrator to revoke all active keys for recovery.'
      );
    }
    const { data } = await apiClient.put(
      `/users/${userId}/public-key`,
      {
        public_key: local.pending.publicKey,
        label: label.trim(),
        ...(keys.length ? { password } : {})
      },
      { unsignedKeyRegistration: active.length === 0 }
    );
    if (normalizeFingerprint(data.fingerprint) !== local.pending.fingerprint) {
      throw new Error(
        'The server returned a different key fingerprint. Refresh before continuing.'
      );
    }
    // refresh verifies the key in history before activating it locally.
    const refreshed = await this.refresh(userId);
    if (refreshed.local.active?.fingerprint !== local.pending.fingerprint) {
      throw new Error(
        'Registration could not be confirmed. Refresh to recover the saved key.'
      );
    }
    return data;
  }

  async discardPending(userId) {
    const { keys, local } = await this.refresh(userId);
    if (
      keys.some(
        (key) =>
          isActiveKey(key) &&
          normalizeFingerprint(key.fingerprint) === local.pending?.fingerprint
      )
    ) {
      throw new Error('This key is already registered. Refresh to use it.');
    }
    await cryptoService.discardPendingIdentityKey(userId);
  }

  async useLocalKey(userId, fingerprint) {
    const keys = await this.list(userId);
    if (
      !keys.some(
        (key) =>
          isActiveKey(key) &&
          normalizeFingerprint(key.fingerprint) === fingerprint
      )
    ) {
      throw new Error('Only an active registered key can be used for signing.');
    }
    await cryptoService.activateIdentityKey(userId, fingerprint);
    return this.refresh(userId);
  }

  async revoke(userId, keyId) {
    await apiClient.delete(`/users/${userId}/public-keys/${keyId}`);
  }
}

export default new UserKeyService();
