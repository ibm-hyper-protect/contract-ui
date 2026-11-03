import assert from 'node:assert/strict';
import test from 'node:test';
import { filterDirectoryUsers, getUserRoles } from '../src/utils/userDirectory.js';

const users = Object.freeze([
  Object.freeze({ id: 'a', name: 'Alex Morgan', email: 'alex@example.test', is_active: true, roles: Object.freeze(['ADMIN', 'AUDITOR']) }),
  Object.freeze({ id: 'b', full_name: 'Jamie Chen', email: 'jamie@example.test', is_active: false, roles: Object.freeze([{ role_name: 'DATA_OWNER' }]) }),
  Object.freeze({ id: 'c', name: 'Sam Patel', email: 'sam@example.test', is_active: true, role: 'ENV_OPERATOR' }),
  Object.freeze({ id: 'd', name: 'Robin Carter', email: 'robin@example.test', is_active: true, roles: [] }),
]);
const ids = result => result.map(user => user.id);

test('default scope preserves active accounts and their original order', () => {
  assert.deepEqual(ids(filterDirectoryUsers(users)), ['a', 'c', 'd']);
});
test('access filters distinguish inactive and all accounts', () => {
  assert.deepEqual(ids(filterDirectoryUsers(users, { access: 'inactive' })), ['b']);
  assert.deepEqual(ids(filterDirectoryUsers(users, { access: 'all' })), ['a', 'b', 'c', 'd']);
});
test('search is trimmed and case-insensitive for name, fallback name and email', () => {
  for (const query of ['  ALEX MORGAN ', 'ALEX@EXAMPLE.TEST']) {
    assert.deepEqual(ids(filterDirectoryUsers(users, { query })), ['a']);
  }
  assert.deepEqual(ids(filterDirectoryUsers(users, { query: 'jamie chen', access: 'all' })), ['b']);
});
test('search finds readable role labels and raw role names', () => {
  for (const query of ['environment operator', 'ENV_OPERATOR']) {
    assert.deepEqual(ids(filterDirectoryUsers(users, { query })), ['c']);
  }
});
test('role filtering considers every assigned role and composes with access/search', () => {
  assert.deepEqual(ids(filterDirectoryUsers(users, { role: 'AUDITOR' })), ['a']);
  assert.deepEqual(ids(filterDirectoryUsers(users, { query: 'jamie', role: 'DATA_OWNER', access: 'inactive' })), ['b']);
  assert.deepEqual(filterDirectoryUsers(users, { query: 'sam', role: 'ADMIN' }), []);
});
test('role representations are normalized without changing priority or input data', () => {
  assert.deepEqual(getUserRoles({ roles: ['auditor', { role_name: 'ADMIN' }, { name: 'VIEWER' }, 'AUDITOR', null] }), ['AUDITOR', 'ADMIN', 'VIEWER']);
  assert.deepEqual(getUserRoles({ role: ['ADMIN', 'VIEWER'] }), ['ADMIN', 'VIEWER']);
  assert.deepEqual(getUserRoles({}), []);
});
test('unknown roles and missing optional names remain searchable', () => {
  const data = [{ id: 'x', email: 'x@example.test', is_active: true, roles: ['CUSTOM_ROLE'] }];
  assert.deepEqual(ids(filterDirectoryUsers(data, { role: 'CUSTOM_ROLE', query: 'custom_role' })), ['x']);
  assert.deepEqual(filterDirectoryUsers(data, { query: 'missing' }), []);
});
test('filtering does not mutate records or their role arrays', () => {
  const before = JSON.stringify(users);
  const filtered = filterDirectoryUsers(users, { access: 'all' });
  assert.notEqual(filtered, users);
  assert.equal(filtered[0], users[0]);
  assert.equal(JSON.stringify(users), before);
});
