import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const signer = require('../main/crypto/signer');
const pair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const localFingerprint = crypto
  .createHash('sha256')
  .update(
    crypto
      .createPublicKey(pair.publicKey)
      .export({ type: 'spki', format: 'der' })
  )
  .digest('hex');
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  electron: { crypto: {} },
  dispatchEvent() {}
};
const { useAuthStore } = await import('../src/store/authStore.js');
const { default: cryptoService } = await import(
  '../src/services/cryptoService.js'
);
const { default: signatureMiddleware } = await import(
  '../src/services/signatureMiddleware.js'
);
const { default: apiClient } = await import('../src/services/apiClient.js');
const { default: userKeyService } = await import(
  '../src/services/userKeyService.js'
);
const { default: exportService } = await import(
  '../src/services/exportService.js'
);
const { default: userService } = await import('../src/services/userService.js');
const { default: rotationService } = await import(
  '../src/services/rotationService.js'
);

const oldKey = {
  id: 'old-key',
  fingerprint: localFingerprint,
  public_key: pair.publicKey,
  label: 'Laptop',
  expires_at: '2099-01-01T00:00:00Z',
  revoked_at: null
};
const newKey = {
  id: 'new-key',
  fingerprint: 'b'.repeat(64),
  label: 'New device',
  expires_at: '2099-02-01T00:00:00Z',
  revoked_at: null
};
let local;
let keys;
let calls;
let handleRequest;

beforeEach((t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  useAuthStore.getState().clearAuth();
  useAuthStore
    .getState()
    .setAuth(
      {
        id: 'owner',
        roles: ['ADMIN'],
        public_key_fingerprint: newKey.fingerprint,
        active_key_count: 1
      },
      'session'
    );
  local = {
    active: { fingerprint: localFingerprint, publicKey: pair.publicKey },
    pending: {
      fingerprint: newKey.fingerprint,
      publicKey: 'pending-public-key'
    },
    fingerprints: [localFingerprint, newKey.fingerprint]
  };
  keys = [{ ...oldKey }];
  calls = [];
  t.mock.method(cryptoService, 'hash', async (value) => signer.hash(value));
  t.mock.method(
    cryptoService,
    'signIdentityHash',
    async (_userId, hash, fingerprint) => {
      if (!local.active) throw new Error('Local signing key unavailable.');
      return {
        signature: signer.sign(hash, pair.privateKey),
        fingerprint: fingerprint || local.active.fingerprint
      };
    }
  );
  t.mock.method(cryptoService, 'getIdentityKeyInfo', async () =>
    structuredClone(local)
  );
  t.mock.method(
    cryptoService,
    'activateIdentityKey',
    async (_userId, fingerprint) => {
      local.active = { fingerprint, publicKey: local.pending?.publicKey };
      local.pending = null;
    }
  );
  t.mock.method(cryptoService, 'discardPendingIdentityKey', async () => {
    local.pending = null;
  });
  handleRequest = async (config) => {
    if (config.method === 'get' && config.url.endsWith('/public-keys'))
      return { keys: structuredClone(keys) };
    throw new Error(`Unexpected request ${config.method} ${config.url}`);
  };
  apiClient.client.defaults.adapter = async (config) => {
    calls.push(config);
    try {
      return {
        data: await handleRequest(config),
        config,
        status: 200,
        headers: {},
        statusText: 'OK'
      };
    } catch (error) {
      error.config = config;
      throw error;
    }
  };
});

test('HTTP signing uses the actual local fingerprint rather than the account’s newest key', async () => {
  const headers = await signatureMiddleware.signRequest('POST', '/builds', {
    name: 'Build'
  });
  assert.equal(headers['X-Key-Fingerprint'], localFingerprint);
  assert.notEqual(
    headers['X-Key-Fingerprint'],
    useAuthStore.getState().user.public_key_fingerprint
  );
  assert.equal(
    signer.verify(
      headers['X-Signature-Hash'],
      headers['X-Signature'],
      pair.publicKey
    ),
    true
  );
  assert.deepEqual(await signatureMiddleware.signRequest('GET', '/builds'), {});
  assert.deepEqual(
    await signatureMiddleware.signRequest('PATCH', '/users/owner/password', {}),
    {}
  );
});

test('unsigned registration is conditional and cannot exempt another mutating endpoint', async () => {
  local.active = null;
  await assert.rejects(
    signatureMiddleware.signRequest('PUT', '/users/owner/public-key', {}),
    /unavailable/
  );
  assert.deepEqual(
    await signatureMiddleware.signRequest(
      'PUT',
      '/users/owner/public-key',
      {},
      { unsignedKeyRegistration: true }
    ),
    {}
  );
  await assert.rejects(
    signatureMiddleware.signRequest(
      'POST',
      '/builds',
      {},
      { unsignedKeyRegistration: true }
    ),
    /unavailable/
  );
});

test('a rejected registration preserves the signing key and durable candidate', async () => {
  const original = handleRequest;
  handleRequest = async (config) => {
    if (config.method === 'put')
      throw new Error('Password confirmation failed');
    return original(config);
  };
  await assert.rejects(
    userKeyService.register({ label: 'Phone', password: 'incorrect' }),
    { message: 'Password confirmation failed' }
  );
  assert.equal(local.active.fingerprint, localFingerprint);
  assert.equal(local.pending.fingerprint, newKey.fingerprint);
  const request = calls.find((call) => call.method === 'put');
  assert.equal(request.headers['X-Key-Fingerprint'], localFingerprint);
  assert.equal(JSON.parse(request.data).password, 'incorrect');
});

test('a lost registration response is recovered from key history after restart', async () => {
  const original = handleRequest;
  handleRequest = async (config) => {
    if (config.method === 'put') {
      keys.unshift({ ...newKey });
      throw new Error('Network Error');
    }
    return original(config);
  };
  await assert.rejects(
    userKeyService.register({ label: 'Phone', password: 'correct' })
  );
  assert.equal(local.active.fingerprint, localFingerprint);
  await userKeyService.refresh('owner');
  assert.equal(local.active.fingerprint, newKey.fingerprint);
  assert.equal(local.pending, null);
  assert.equal(useAuthStore.getState().user.active_key_count, 2);
});

test('zero-active-key recovery sends password confirmation without a request signature', async () => {
  keys = [{ ...oldKey, revoked_at: '2026-01-01T00:00:00Z' }];
  const original = handleRequest;
  handleRequest = async (config) => {
    if (config.method === 'put') {
      const body = JSON.parse(config.data);
      assert.equal(body.password, 'correct');
      assert.equal(config.headers['X-Signature'], undefined);
      keys.unshift({ ...newKey });
      return { fingerprint: newKey.fingerprint };
    }
    return original(config);
  };
  await userKeyService.register({
    label: 'Recovered device',
    password: 'correct'
  });
  assert.equal(local.active.fingerprint, newKey.fingerprint);
  assert.equal(useAuthStore.getState().isSetupRequired(), false);
});

test('first registration needs neither password nor a preexisting local signing key', async () => {
  keys = [];
  local.active = null;
  const original = handleRequest;
  handleRequest = async (config) => {
    if (config.method === 'put') {
      assert.equal(JSON.parse(config.data).password, undefined);
      assert.equal(config.headers['X-Signature'], undefined);
      keys.push({ ...newKey });
      return { fingerprint: newKey.fingerprint };
    }
    return original(config);
  };
  await userKeyService.register({ label: 'First device', password: '' });
  assert.equal(local.active.fingerprint, newKey.fingerprint);
});

test('registration blocks the fifth-slot overflow and a new device without an active imported key', async () => {
  keys = Array.from({ length: 5 }, (_, index) => ({
    ...oldKey,
    id: String(index)
  }));
  await assert.rejects(
    userKeyService.register({ label: '', password: 'correct' }),
    /Five keys/
  );
  keys = [{ ...oldKey }];
  local.active = null;
  await assert.rejects(
    userKeyService.register({ label: '', password: 'correct' }),
    /Import an active key/
  );
  assert.equal(
    calls.some((call) => call.method === 'put'),
    false
  );
});

test('a server-confirmed candidate is activated instead of discarded', async () => {
  keys.push({ ...newKey });
  await userKeyService.discardPending('owner');
  assert.equal(local.active.fingerprint, newKey.fingerprint);
  assert.equal(local.pending, null);
});

test('an older active local key stays usable when another device registers a newer key', async () => {
  local.pending = null;
  keys = [{ ...newKey }, { ...oldKey }];
  await userKeyService.refresh('owner');
  assert.equal(useAuthStore.getState().publicKeyFingerprint, localFingerprint);
  assert.equal(
    useAuthStore.getState().user.public_key_fingerprint,
    newKey.fingerprint
  );
  assert.equal(useAuthStore.getState().isKeyExpired(), false);
  keys[1].revoked_at = '2026-01-01T00:00:00Z';
  await userKeyService.refresh('owner');
  assert.equal(useAuthStore.getState().isKeyExpired(), true);
  assert.equal(useAuthStore.getState().isSetupRequired(), false);
});

test('download receipt and HTTP request pin the same key across a local key change', async (t) => {
  t.mock.method(
    cryptoService,
    'signIdentityHash',
    async (_userId, hash, fingerprint) => {
      const result = {
        signature: signer.sign(hash, pair.privateKey),
        fingerprint: fingerprint || localFingerprint
      };
      local.active = { fingerprint: newKey.fingerprint };
      return result;
    }
  );
  handleRequest = async (config) => {
    assert.equal(config.headers['X-Key-Fingerprint'], localFingerprint);
    assert.equal(
      signer.verify(
        'a'.repeat(64),
        JSON.parse(config.data).signature,
        pair.publicKey
      ),
      true
    );
    assert.equal(
      signer.verify(
        config.headers['X-Signature-Hash'],
        config.headers['X-Signature'],
        pair.publicKey
      ),
      true
    );
    return { acknowledged: true };
  };
  assert.deepEqual(
    await exportService.acknowledgeDownload('build', 'a'.repeat(64)),
    { acknowledged: true }
  );
});

test('admin all-key recovery and expired-only cleanup call different backend endpoints', async () => {
  handleRequest = async () => ({ revoked_count: 2 });
  await userService.forceKeyRotation('other-user');
  await rotationService.revokeExpiredKey('other-user');
  assert.equal(calls[0].url, '/users/other-user/public-keys/revoke-all');
  assert.equal(calls[1].url, '/rotation/revoke-key/other-user');
});

test('a missing local signing key surfaces its message without retrying an unsigned mutation', async () => {
  local.active = null;
  await assert.rejects(apiClient.post('/builds', { name: 'No key' }), { message: 'Local signing key unavailable.' });
  assert.equal(calls.length, 0);
});
