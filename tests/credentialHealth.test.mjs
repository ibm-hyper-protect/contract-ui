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
