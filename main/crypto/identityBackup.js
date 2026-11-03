const { dialog } = require('electron');
const crypto = require('crypto');
const { promisify } = require('util');
const fs = require('fs').promises;
const keyStorage = require('./keyStorage');

const scrypt = promisify(crypto.scrypt);

function validatePassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 1024
  ) {
    throw new Error('Use a backup passphrase between 12 and 1024 characters.');
  }
}

async function deriveKey(password, salt) {
  return scrypt(password, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
}

module.exports = {
  async exportBackup(userId, password) {
    validatePassword(password);
    const privateKey = await keyStorage.getPrivateKey(userId);
    if (!privateKey) throw new Error('No local identity key to export.');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export encrypted device key',
      defaultPath: 'identity-key-backup.json',
      filters: [{ name: 'Encrypted identity key', extensions: ['json'] }]
    });
    if (canceled || !filePath) return null;
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = await deriveKey(password, salt);
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([
        cipher.update(privateKey, 'utf8'),
        cipher.final()
      ]);
      const backup = {
        format: 'contract-ui-identity',
        version: 1,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        encrypted: encrypted.toString('base64')
      };
      await fs.writeFile(temporary, JSON.stringify(backup), {
        flag: 'wx',
        mode: 0o600
      });
      await fs.rename(temporary, filePath);
      return { success: true };
    } finally {
      key.fill(0);
      await fs.rm(temporary, { force: true });
    }
  },

  async importBackup(userId, password) {
    validatePassword(password);
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import encrypted device key',
      properties: ['openFile'],
      filters: [{ name: 'Encrypted identity key', extensions: ['json'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const file = await fs.open(filePaths[0], 'r');
    let backup;
    try {
      if ((await file.stat()).size > 65536)
        throw new Error('Invalid identity backup.');
      backup = JSON.parse(await file.readFile('utf8'));
    } finally {
      await file.close();
    }
    if (backup.format !== 'contract-ui-identity' || backup.version !== 1)
      throw new Error('Unsupported identity backup.');
    const salt = Buffer.from(backup.salt, 'base64');
    const iv = Buffer.from(backup.iv, 'base64');
    const tag = Buffer.from(backup.authTag, 'base64');
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16)
      throw new Error('Invalid identity backup.');
    const key = await deriveKey(password, salt);
    let privateKey;
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      privateKey = Buffer.concat([
        decipher.update(Buffer.from(backup.encrypted, 'base64')),
        decipher.final()
      ]).toString('utf8');
    } catch {
      throw new Error(
        'Cannot unlock this backup. Check the passphrase and file.'
      );
    } finally {
      key.fill(0);
    }
    const parsed = crypto.createPrivateKey(privateKey);
    if (
      parsed.asymmetricKeyType !== 'rsa' ||
      parsed.asymmetricKeyDetails.modulusLength !== 4096
    ) {
      throw new Error('The backup must contain an RSA-4096 identity key.');
    }
    return keyStorage.withUser(userId, async () => {
      const state = await keyStorage.readState(userId);
      if (state.pendingFingerprint)
        throw new Error('Finish or discard the pending key before importing.');
      const info = keyStorage.describeKey(privateKey);
      state.keys[info.fingerprint] = privateKey;
      // Server membership must be checked before this imported key can sign.
      state.pendingFingerprint = info.fingerprint;
      await keyStorage.writeState(userId, state);
      return info;
    });
  }
};
