const { app, safeStorage } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const keyManager = require('./keyManager');
const signer = require('./signer');

class KeyStorage {
  constructor() {
    this.storageDir = path.join(app.getPath('userData'), 'keys');
    this.operations = new Map();
  }

  /**
   * Ensure the storage directory exists.
   */
  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      throw new Error('Cannot create local key storage.', { cause: error });
    }
  }

  /**
   * Encode the legacy format for compatibility fixtures.
   * New identity state uses safeStorage in writeState().
   * @param {string} data - Data to encrypt
   * @returns {Object} - {encrypted, iv, authTag}
   */
  encryptData(data) {
    // Legacy files derive their key from the application data path.
    const machineKey = crypto
      .createHash('sha256')
      .update(app.getPath('userData'))
      .digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', machineKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data)),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  /**
   * Decode an existing legacy key file for migration.
   * @param {Object} encryptedData - {encrypted, iv, authTag}
   * @returns {string} - Decrypted data
   */
  decryptData(encryptedData) {
    const machineKey = crypto
      .createHash('sha256')
      .update(app.getPath('userData'))
      .digest();

    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', machineKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  keyPath(userId, suffix = 'identity.json') {
    if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error('Invalid key owner.');
    }
    return path.join(this.storageDir, `${userId}-${suffix}`);
  }

  // Serialize read/modify/write operations, including migration and key generation.
  async withUser(userId, operation) {
    this.keyPath(userId);
    const previous = this.operations.get(userId) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.operations.set(userId, current);
    try {
      return await current;
    } finally {
      if (this.operations.get(userId) === current)
        this.operations.delete(userId);
    }
  }

  describeKey(privateKey) {
    const publicKey = crypto
      .createPublicKey(privateKey)
      .export({ type: 'spki', format: 'pem' });
    const fingerprint = keyManager
      .computeFingerprint(publicKey)
      .replace(/:/g, '')
      .toLowerCase();
    return { publicKey, fingerprint };
  }

  async readState(userId) {
    try {
      const encrypted = JSON.parse(
        await fs.readFile(this.keyPath(userId), 'utf8')
      );
      const contents =
        encrypted.protection === 'safeStorage'
          ? safeStorage.decryptString(Buffer.from(encrypted.data, 'base64'))
          : this.decryptData(encrypted);
      const state = JSON.parse(contents);
      if (state.version !== 1 || !state.keys)
        throw new Error('Unsupported identity key storage.');
      return state;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const state = {
      version: 1,
      activeFingerprint: null,
      pendingFingerprint: null,
      keys: {}
    };
    try {
      // Migrate the existing device key; keep the original file as a recovery copy.
      const legacy = JSON.parse(
        await fs.readFile(this.keyPath(userId, 'identity.key'), 'utf8')
      );
      const privateKey = this.decryptData(legacy);
      const { fingerprint } = this.describeKey(privateKey);
      state.keys[fingerprint] = privateKey;
      state.activeFingerprint = fingerprint;
      await this.writeState(userId, state);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return state;
  }

  async writeState(userId, state) {
    await this.ensureStorageDir();
    if (
      !safeStorage.isEncryptionAvailable() ||
      safeStorage.getSelectedStorageBackend?.() === 'basic_text'
    ) {
      throw new Error(
        'Secure operating system storage is unavailable. Unlock your keychain or credential store and try again.'
      );
    }
    const encrypted = {
      protection: 'safeStorage',
      data: safeStorage.encryptString(JSON.stringify(state)).toString('base64')
    };
    const destination = this.keyPath(userId);
    const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
    try {
      const file = await fs.open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(JSON.stringify(encrypted), 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }

  keyInfo(state, fingerprint) {
    return fingerprint && state.keys[fingerprint]
      ? this.describeKey(state.keys[fingerprint])
      : null;
  }

  /** Return public metadata only. Private identity keys stay in the main process. */
  async getIdentityKeyInfo(userId) {
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      return {
        active: this.keyInfo(state, state.activeFingerprint),
        pending: this.keyInfo(state, state.pendingFingerprint),
        fingerprints: Object.keys(state.keys)
      };
    });
  }

  /** Persist a candidate before registration without replacing the signing key. */
  async prepareIdentityKey(userId) {
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      if (!state.pendingFingerprint) {
        const { privateKey } = await keyManager.generateIdentityKeyPair();
        const { fingerprint } = this.describeKey(privateKey);
        state.keys[fingerprint] = privateKey;
        state.pendingFingerprint = fingerprint;
        await this.writeState(userId, state);
      }
      return this.keyInfo(state, state.pendingFingerprint);
    });
  }

  /** Activate only after the renderer has confirmed this key in server history. */
  async activateIdentityKey(userId, fingerprint) {
    if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint))
      throw new Error('Invalid key fingerprint.');
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      if (!state.keys[fingerprint])
        throw new Error('This key is not stored on this device.');
      state.activeFingerprint = fingerprint;
      if (state.pendingFingerprint === fingerprint)
        state.pendingFingerprint = null;
      await this.writeState(userId, state);
    });
  }

  /** Discard a candidate only after checking it was not registered on the server. */
  async discardPendingIdentityKey(userId) {
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      if (
        state.pendingFingerprint &&
        state.pendingFingerprint !== state.activeFingerprint
      ) {
        delete state.keys[state.pendingFingerprint];
      }
      state.pendingFingerprint = null;
      await this.writeState(userId, state);
    });
  }

  /** Pin both the signature and fingerprint to the same locally stored key. */
  async signIdentityHash(userId, hash, fingerprint = null) {
    if (
      fingerprint !== null &&
      (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint))
    )
      throw new Error('Invalid key fingerprint.');
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash))
      throw new Error('Invalid signing hash.');
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      const selected = fingerprint || state.activeFingerprint;
      if (
        !selected ||
        !state.keys[selected] ||
        selected === state.pendingFingerprint
      ) {
        throw new Error(
          'Local signing key unavailable. Open Account Settings to set up this device.'
        );
      }
      return {
        signature: signer.sign(hash, state.keys[selected]),
        fingerprint: selected
      };
    });
  }

  async storePrivateKey(userId, privateKey) {
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      const { fingerprint } = this.describeKey(privateKey);
      state.keys[fingerprint] = privateKey;
      state.activeFingerprint = fingerprint;
      await this.writeState(userId, state);
    });
  }

  async getPrivateKey(userId) {
    return this.withUser(userId, async () => {
      const state = await this.readState(userId);
      return state.keys[state.activeFingerprint] || null;
    });
  }

  async deletePrivateKey(userId) {
    return this.withUser(userId, async () => {
      await fs.rm(this.keyPath(userId), { force: true });
      await fs.rm(this.keyPath(userId, 'identity.key'), { force: true });
    });
  }

  async hasPrivateKey(userId) {
    return Boolean(await this.getPrivateKey(userId));
  }
}

module.exports = new KeyStorage();
