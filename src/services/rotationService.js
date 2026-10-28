import apiClient from './apiClient';
import { useAuthStore } from '../store/authStore';
import userKeyService, { isActiveKey } from './userKeyService';

/**
 * Rotation Service - Credential rotation monitoring
 * Handles password and public key expiry monitoring and enforcement
 */
class RotationService {
  /** Load complete histories for enabled accounts; a failed read must not become a legacy fallback. */
  async getKeyInventory(users) {
    const entries = await Promise.all(users.filter(user => user.is_active).map(async user => (
      [user.id, await userKeyService.list(user.id)]
    )));
    return Object.fromEntries(entries);
  }

  /** Revoke selected devices individually, preserving unrelated keys and partial results. */
  async bulkRevokeCredentialKeys(items) {
    const results = { success: [], failed: [] };
    for (const { userId, keyId } of items) {
      try {
        if (!userId || !keyId) throw new Error('A user and device key are required.');
        await userKeyService.revoke(userId, keyId);
        results.success.push({ userId, keyId });
      } catch (error) {
        results.failed.push({ userId, keyId, error: error.message });
      }
    }
    return results;
  }

  /**
   * Get expired credentials (admin only)
   * @returns {Promise<Object>} - {expired_passwords: Array, expired_keys: Array}
   */
  async getExpiredCredentials() {
    const response = await apiClient.get('/rotation/expired');
    return response.data;
  }

  /**
   * Force password change for a user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async forcePasswordChange(userId) {
    const response = await apiClient.post(`/rotation/force-password-change/${userId}`);
    return response.data;
  }

  /**
   * Revoke expired public key (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async revokeExpiredKey(userId) {
    const response = await apiClient.post(`/rotation/revoke-key/${userId}`);
    return response.data;
  }

  /**
   * Check current user's credential status
   * @returns {Promise<Object>} - {passwordExpiry, keyExpiry, warnings}
   */
  async checkMyCredentialStatus() {
    const user = useAuthStore.getState().user;
    if (!user) return null;

    const status = {
      passwordExpiry: null,
      keyExpiry: null,
      warnings: []
    };

    // Check password expiry
    if (user.password_changed_at) {
      const passwordChangedAt = new Date(user.password_changed_at);
      const passwordAge = Date.now() - passwordChangedAt.getTime();
      const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
      const daysUntilExpiry = 90 - daysOld;

      if (daysOld >= 90) {
        status.warnings.push({
          type: 'password',
          severity: 'error',
          message: 'Your password has expired. Please change it immediately.',
          daysOverdue: daysOld - 90
        });
      } else if (daysOld >= 83) {
        status.warnings.push({
          type: 'password',
          severity: 'warning',
          message: `Your password will expire in ${daysUntilExpiry} days.`,
          daysUntilExpiry
        });
      }

      status.passwordExpiry = {
        changedAt: user.password_changed_at,
        daysOld,
        daysUntilExpiry,
        isExpired: daysOld >= 90
      };
    }

    const localKey = useAuthStore.getState().localIdentityKey;
    if (localKey) {
      const daysUntilExpiry = Math.ceil((new Date(localKey.expires_at) - Date.now()) / 86400000);
      const usable = isActiveKey(localKey);
      status.keyExpiry = {
        expiresAt: localKey.expires_at, daysUntilExpiry,
        isExpired: !usable, fingerprint: localKey.fingerprint
      };
      if (!usable || daysUntilExpiry <= 7) status.warnings.push({
        type: 'key', severity: usable ? 'warning' : 'error',
        message: usable ? `This device key expires in ${daysUntilExpiry} days.` : 'This device key cannot sign. Open Account Settings.'
      });
    }

    return status;
  }

  /**
   * Get expiry warnings for current user
   * @returns {Promise<Array>} - Array of warning objects
   */
  async getExpiryWarnings() {
    const status = await this.checkMyCredentialStatus();
    return status?.warnings || [];
  }

  /**
   * Check if current user has expired credentials
   * @returns {Promise<boolean>}
   */
  async hasExpiredCredentials() {
    const status = await this.checkMyCredentialStatus();
    if (!status) return false;

    return status.warnings.some(w => w.severity === 'error');
  }

  /**
   * Get credential expiry summary for all users (admin only)
   * @returns {Promise<Object>} - Summary statistics
   */
  async getExpiryDashboard() {
    const expiredData = await this.getExpiredCredentials();

    const summary = {
      totalExpiredPasswords: expiredData.expired_passwords?.length || 0,
      totalExpiredKeys: expiredData.expired_public_keys?.length || 0,
      totalAffectedUsers: new Set([
        ...(expiredData.expired_passwords?.map(u => u.user_id) || []),
        ...(expiredData.expired_public_keys?.map(u => u.user_id) || [])
      ]).size,
      expiredPasswords: expiredData.expired_passwords || [],
      expiredKeys: expiredData.expired_public_keys || []
    };

    return summary;
  }

  /**
   * Get users with credentials expiring soon (admin only)
   * @param {number} days - Number of days threshold (default: 7)
   * @returns {Promise<Array>}
   */
  async getUsersExpiringSoon(days = 7) {
    const { data } = await apiClient.get('/users');
    const users = (data.users || []).filter(user => user.is_active);
    const now = Date.now();
    const threshold = now + days * 86400000;
    const rows = await Promise.all(users.map(async user => {
      const identity = { user_id: user.id, username: user.name, full_name: user.name, email: user.email };
      const result = [];
      const passwordExpiry = new Date(user.password_expires_at).getTime();
      if (!user.must_change_password && passwordExpiry > now && passwordExpiry <= threshold) result.push({
        ...identity, type: 'password', password_expires_at: user.password_expires_at,
        days_until_expiry: Math.ceil((passwordExpiry - now) / 86400000)
      });
      const keys = await userKeyService.list(user.id);
      keys.filter(isActiveKey).forEach(key => {
        const expires = new Date(key.expires_at).getTime();
        if (expires <= threshold) result.push({
          ...identity, type: 'key', key_id: key.id, label: key.label,
          key_fingerprint: key.fingerprint, key_expires_at: key.expires_at,
          days_until_expiry: Math.ceil((expires - now) / 86400000)
        });
      });
      return result;
    }));
    return rows.flat();
  }

  /**
   * Bulk force password change for multiple users (admin only)
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<Object>} - {success: Array, failed: Array}
   */
  async bulkForcePasswordChange(userIds) {
    const results = {
      success: [],
      failed: []
    };

    for (const userId of userIds) {
      try {
        await this.forcePasswordChange(userId);
        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          userId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Bulk revoke expired keys for multiple users (admin only)
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<Object>} - {success: Array, failed: Array}
   */
  async bulkRevokeKeys(userIds) {
    const results = {
      success: [],
      failed: []
    };

    for (const userId of userIds) {
      try {
        await this.revokeExpiredKey(userId);
        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          userId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Calculate password strength
   * @param {string} password - Password to check
   * @returns {Object} - {score: number, feedback: Array<string>}
   */
  calculatePasswordStrength(password) {
    const feedback = [];
    let score = 0;

    // Length check
    if (password.length >= 12) {
      score += 2;
    } else if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('Password should be at least 8 characters long');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add uppercase letters');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add lowercase letters');
    }

    // Number check
    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add numbers');
    }

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add special characters');
    }

    // Common patterns check
    const commonPatterns = ['password', '123456', 'qwerty', 'admin'];
    if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
      score -= 2;
      feedback.push('Avoid common patterns');
    }

    return {
      score: Math.max(0, Math.min(5, score)),
      strength: score >= 4 ? 'strong' : score >= 2 ? 'medium' : 'weak',
      feedback
    };
  }

  /**
   * Get rotation policy information
   * @returns {Object} - Policy details
   */
  getRotationPolicy() {
    return {
      passwordExpiry: {
        days: 90,
        warningDays: 7,
        description: 'Passwords must be changed every 90 days'
      },
      publicKeyExpiry: {
        days: 90,
        warningDays: 7,
        description: 'Public keys must be rotated every 90 days'
      },
      enforcement: {
        blockExpiredPassword: true,
        blockExpiredKey: true,
        description: 'Users with expired credentials cannot perform operations'
      }
    };
  }
}

export default new RotationService();

