import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const keyManager = require('../main/crypto/keyManager');
const signer = require('../main/crypto/signer');

async function loadModule(relative, replacements) {
  const url = new URL(relative, root);
  const module = { exports: {} };
  const localRequire = createRequire(url);
  vm.runInNewContext(
    await readFile(url, 'utf8'),
    {
      require: (name) => replacements[name] || localRequire(name),
      module,
      Buffer,
      console
    },
    { filename: url.pathname }
  );
  return module.exports;
}

async function fixture(t, replacements = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'contract-ui-keys-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const protectionKey = crypto.randomBytes(32);
  const electron = {
    app: { getPath: () => directory },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', protectionKey, iv);
        const encrypted = Buffer.concat([
          cipher.update(value, 'utf8'),
          cipher.final()
        ]);
        return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
      },
      decryptString: (value) => {
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          protectionKey,
          value.subarray(0, 12)
        );
        decipher.setAuthTag(value.subarray(12, 28));
        return Buffer.concat([
          decipher.update(value.subarray(28)),
          decipher.final()
        ]).toString('utf8');
      }
    }
  };
  const storage = await loadModule('main/crypto/keyStorage.js', {
    electron,
    ...replacements
  });
  return { directory, electron, storage };
}

const initial = await keyManager.generateIdentityKeyPair();

test('legacy migration derives the local fingerprint and preserves the original file', async (t) => {
  const { storage } = await fixture(t);
  await storage.ensureStorageDir();
  const legacyPath = storage.keyPath('owner', 'identity.key');
  const legacyData = JSON.stringify(storage.encryptData(initial.privateKey));
  await writeFile(legacyPath, legacyData);
  const info = await storage.getIdentityKeyInfo('owner');
  assert.equal(
    info.active.fingerprint,
    keyManager
      .computeFingerprint(initial.publicKey)
      .replaceAll(':', '')
      .toLowerCase()
  );
  assert.equal(await storage.getPrivateKey('owner'), initial.privateKey);
  assert.equal(await readFile(legacyPath, 'utf8'), legacyData);
  assert.equal((await stat(storage.keyPath('owner'))).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(info).includes('PRIVATE KEY'), false);
});

test('concurrent preparation creates one durable candidate without replacing the signing key', async (t) => {
  const { storage, electron } = await fixture(t);
  await storage.storePrivateKey('owner', initial.privateKey);
  const old = (await storage.getIdentityKeyInfo('owner')).active;
  const [a, b] = await Promise.all([
    storage.prepareIdentityKey('owner'),
    storage.prepareIdentityKey('owner')
  ]);
  assert.equal(a.fingerprint, b.fingerprint);
  const reloaded = await loadModule('main/crypto/keyStorage.js', { electron });
  assert.equal(
    (await reloaded.getIdentityKeyInfo('owner')).pending.fingerprint,
    a.fingerprint
  );
  const hash = signer.hash('request');
  const before = await storage.signIdentityHash('owner', hash);
  assert.equal(before.fingerprint, old.fingerprint);
  await assert.rejects(
    storage.signIdentityHash('owner', hash, a.fingerprint),
    /unavailable/
  );
  await storage.activateIdentityKey('owner', a.fingerprint);
  const after = await storage.signIdentityHash('owner', hash);
  assert.equal(after.fingerprint, a.fingerprint);
  assert.equal(signer.verify(hash, after.signature, a.publicKey), true);
  // A receipt created before activation can pin its HTTP signature to the same old key.
  const pinned = await storage.signIdentityHash('owner', hash, old.fingerprint);
  assert.equal(signer.verify(hash, pinned.signature, initial.publicKey), true);
});

test('failed atomic activation preserves the existing key and candidate for recovery', async (t) => {
  let failRename = false;
  const { storage } = await fixture(t, {
    fs: {
      promises: {
        ...fs,
        rename: async (...args) => {
          if (failRename) throw new Error('Disk failure');
          return fs.rename(...args);
        }
      }
    }
  });
  await storage.storePrivateKey('owner', initial.privateKey);
  const before = await storage.getIdentityKeyInfo('owner');
  // Use a second stored key as a candidate to avoid testing randomness here.
  const candidate = await keyManager.generateIdentityKeyPair();
  const state = await storage.readState('owner');
  const { fingerprint } = storage.describeKey(candidate.privateKey);
  state.keys[fingerprint] = candidate.privateKey;
  state.pendingFingerprint = fingerprint;
  await storage.writeState('owner', state);
  failRename = true;
  await assert.rejects(
    storage.activateIdentityKey('owner', fingerprint),
    /Disk failure/
  );
  const recovered = await storage.getIdentityKeyInfo('owner');
  assert.equal(recovered.active.fingerprint, before.active.fingerprint);
  assert.equal(recovered.pending.fingerprint, fingerprint);
  assert.equal(await storage.getPrivateKey('owner'), initial.privateKey);
});

test('encrypted backup round trip, wrong passphrase, and tampering never replace the current key', async (t) => {
  const source = await fixture(t);
  const target = await fixture(t);
  await source.storage.storePrivateKey('owner', initial.privateKey);
  const backupPath = path.join(source.directory, 'backup.json');
  const dialog = {
    showSaveDialog: async () => ({ filePath: backupPath }),
    showOpenDialog: async () => ({ filePaths: [backupPath] })
  };
  const sourceBackup = await loadModule('main/crypto/identityBackup.js', {
    electron: { dialog },
    './keyStorage': source.storage
  });
  const targetBackup = await loadModule('main/crypto/identityBackup.js', {
    electron: { dialog },
    './keyStorage': target.storage
  });
  await sourceBackup.exportBackup('owner', 'a separate strong passphrase');
  const saved = await readFile(backupPath, 'utf8');
  assert.equal(saved.includes('PRIVATE KEY'), false);
  await assert.rejects(
    targetBackup.importBackup('owner', 'incorrect passphrase'),
    /Cannot unlock/
  );
  assert.equal((await target.storage.getIdentityKeyInfo('owner')).active, null);
  const imported = await targetBackup.importBackup(
    'owner',
    'a separate strong passphrase'
  );
  assert.equal(
    imported.fingerprint,
    (await source.storage.getIdentityKeyInfo('owner')).active.fingerprint
  );
  assert.equal((await target.storage.getIdentityKeyInfo('owner')).active, null);
  await target.storage.activateIdentityKey('owner', imported.fingerprint);
  const altered = JSON.parse(saved);
  const bytes = Buffer.from(altered.encrypted, 'base64');
  bytes[0] ^= 1;
  altered.encrypted = bytes.toString('base64');
  await writeFile(backupPath, JSON.stringify(altered));
  await assert.rejects(
    targetBackup.importBackup('owner', 'a separate strong passphrase'),
    /Cannot unlock/
  );
  assert.equal(await target.storage.getPrivateKey('owner'), initial.privateKey);
});

test('invalid owner paths, absent keys, and invalid hashes fail before signing', async (t) => {
  const { storage } = await fixture(t);
  await assert.rejects(
    storage.getIdentityKeyInfo('../other'),
    /Invalid key owner/
  );
  await assert.rejects(
    storage.signIdentityHash('owner', 'not-a-hash'),
    /Invalid signing hash/
  );
  await assert.rejects(
    storage.signIdentityHash('owner', 'a'.repeat(64)),
    /unavailable/
  );
});

test('an unavailable or insecure OS credential store never saves a new key', async t => {
  const { storage, electron } = await fixture(t);
  electron.safeStorage.isEncryptionAvailable = () => false;
  await assert.rejects(storage.storePrivateKey('owner', initial.privateKey), /credential store/);
  await assert.rejects(readFile(storage.keyPath('owner')), { code: 'ENOENT' });
  electron.safeStorage.isEncryptionAvailable = () => true;
  electron.safeStorage.getSelectedStorageBackend = () => 'basic_text';
  await assert.rejects(storage.storePrivateKey('owner', initial.privateKey), /credential store/);
  await assert.rejects(readFile(storage.keyPath('owner')), { code: 'ENOENT' });
});

test('preload maps identity operations to their exact IPC channels', async () => {
  let bridge;
  await loadModule('main/preload.js', { electron: {
    contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
    ipcRenderer: { invoke: (...args) => args }
  } });
  for (const method of ['getIdentityKeyInfo', 'prepareIdentityKey', 'discardPendingIdentityKey']) {
    assert.deepEqual(Array.from(bridge.crypto[method]('owner')), [`crypto:${method}`, 'owner']);
  }
  for (const method of ['activateIdentityKey', 'exportIdentityBackup', 'importIdentityBackup']) {
    assert.deepEqual(Array.from(bridge.crypto[method]('owner', 'value')), [`crypto:${method}`, 'owner', 'value']);
  }
  assert.deepEqual(Array.from(bridge.crypto.signIdentityHash('owner', 'hash', 'fingerprint')), ['crypto:signIdentityHash', 'owner', 'hash', 'fingerprint']);
});
