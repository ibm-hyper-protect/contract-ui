import test from 'node:test';
import assert from 'node:assert/strict';
import { getCredentialHealth } from '../src/utils/credentialHealth.js';

const now = Date.parse('2026-10-21T12:00:00Z');
const day = 86400000;
const date = days => new Date(now + days * day).toISOString();
const user = {
  id: 'one',
  name: 'Alex',
  email: 'alex@example.test',
  is_active: true,
  password_expires_at: date(90),
  public_key_expires_at: date(90),
  public_key_fingerprint: 'sample',
};

test('healthy credentials are not counted as issues', () => {
  const health = getCredentialHealth([user], now);
  assert.equal(health.attentionUsers, 0);
  assert.equal(health.expiringUsers, 0);
  assert.deepEqual(health.credentials.map(item => item.status), ['active', 'active']);
});

test('missing keys and required password changes retain their own labels', () => {
  const health = getCredentialHealth([{
    ...user,
    must_change_password: true,
    public_key_fingerprint: null,
  }], now);
  assert.deepEqual(health.credentials.map(item => item.status), ['required', 'missing']);
  assert.equal(health.attentionUsers, 1);
  assert.equal(health.attentionPasswords, 1);
  assert.equal(health.attentionKeys, 1);
  assert.equal(health.credentials[1].expiresAt, null);
  assert.equal(health.credentials[1].daysRemaining, null);
});

test('disabled users are excluded from credential actions and urgency counts', () => {
  const health = getCredentialHealth([{
    ...user,
    is_active: false,
    must_change_password: true,
    public_key_fingerprint: null,
  }], now);
  assert.equal(health.credentials.length, 0);
  assert.equal(health.attentionUsers, 0);
});

test('expiry is exact at the current instant and the 30-day boundary', () => {
  const health = getCredentialHealth([{
    ...user,
    password_expires_at: date(0),
    public_key_expires_at: date(30),
  }], now);
  assert.deepEqual(health.credentials.map(item => item.status), ['expired', 'soon']);
  const outside = getCredentialHealth([{
    ...user,
    public_key_expires_at: new Date(now + 30 * day + 1).toISOString(),
  }], now);
  assert.equal(outside.credentials[1].status, 'active');
});

test('a credential expiring later today remains upcoming, rather than expired', () => {
  const health = getCredentialHealth([{
    ...user,
    password_expires_at: new Date(now + 1000).toISOString(),
  }], now);
  assert.equal(health.credentials[0].status, 'soon');
  assert.equal(health.credentials[0].daysRemaining, 1);
});

test('invalid, missing and zero dates do not appear healthy', () => {
  for (const value of [null, 'invalid', '0001-01-01T00:00:00Z']) {
    const health = getCredentialHealth([{
      ...user,
      password_expires_at: value,
      public_key_expires_at: value,
    }], now);
    assert.deepEqual(health.credentials.map(item => item.status), ['unknown', 'unknown']);
    assert.equal(health.attentionUsers, 1);
  }
});

test('overlapping credential issues count each affected user once', () => {
  const health = getCredentialHealth([
    { ...user, must_change_password: true, public_key_fingerprint: null },
    { ...user, id: 'two', password_expires_at: date(-1) },
  ], now);
  assert.equal(health.attentionUsers, 2);
  assert.equal(health.attentionPasswords, 2);
  assert.equal(health.attentionKeys, 1);
});

test('upcoming users are deduplicated across password and key expiry', () => {
  const health = getCredentialHealth([{
    ...user,
    password_expires_at: date(3),
    public_key_expires_at: date(4),
  }], now);
  assert.equal(health.expiringUsers, 1);
  assert.equal(health.attentionUsers, 0);
});

test('deriving the review leaves the API snapshot unchanged', () => {
  const input = structuredClone(user);
  getCredentialHealth([input], now);
  assert.deepEqual(input, user);
});


test('device histories count each unrevoked key and deduplicate affected users', () => {
  const inventory = { one: [
    { id: 'laptop', label: 'Laptop', fingerprint: 'aaa', expires_at: date(-1) },
    { id: 'desktop', label: 'Desktop', fingerprint: 'bbb', expires_at: date(-2) },
    { id: 'tablet', label: 'Tablet', fingerprint: 'ccc', expires_at: date(90) },
    { id: 'revoked', fingerprint: 'ddd', expires_at: date(-9), revoked_at: date(-8) },
  ] };
  const before = structuredClone(inventory);
  const health = getCredentialHealth([user], now, inventory);
  assert.equal(health.deviceKeys, true);
  assert.equal(health.attentionKeys, 2);
  assert.equal(health.attentionUsers, 1);
  const keys = health.credentials.filter(item => item.kind === 'key');
  assert.deepEqual(keys.map(item => item.keyId), ['laptop', 'desktop', 'tablet']);
  assert.equal(new Set(keys.map(item => item.id)).size, 3);
  assert.equal(keys[0].label, 'Laptop');
  assert.equal(keys[0].fingerprint, 'aaa');
  assert.deepEqual(inventory, before);
});

test('empty and fully revoked histories show registration reminders, never legacy keys', () => {
  for (const keys of [[], [{ id: 'revoked', fingerprint: 'old', revoked_at: date(-1) }]]) {
    const health = getCredentialHealth([user], now, { one: keys });
    const key = health.credentials.find(item => item.kind === 'key');
    assert.equal(key.status, 'missing');
    assert.equal(key.keyId, undefined);
    assert.equal(health.attentionKeys, 1);
  }
});

test('device inventories ignore disabled accounts and deduplicate upcoming users', () => {
  const health = getCredentialHealth([
    { ...user, password_expires_at: date(2) }, { ...user, id: 'disabled', is_active: false },
  ], now, { one: [
    { id: 'a', fingerprint: 'aaa', expires_at: date(3) },
    { id: 'b', fingerprint: 'bbb', expires_at: date(5) },
  ] });
  assert.equal(health.expiringUsers, 1);
  assert.equal(health.credentials.length, 3);
});

test('incomplete inventories fail instead of exposing a misleading legacy key', () => {
  assert.throws(() => getCredentialHealth([user], now, {}), TypeError);
  assert.equal(getCredentialHealth([user], now).deviceKeys, false);
});
