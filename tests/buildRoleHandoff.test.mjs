/*
Copyright (c) 2026 IBM Corp.
All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import { isAssignedNextRole } from '../src/utils/buildRoleHandoff.js';
const valid = { userId: 'me', role: 'DATA_OWNER', roles: ['ADMIN', 'DATA_OWNER'], assignments: [{ user_id: 'me', role_name: 'DATA_OWNER' }] };
test('requires both an account role and the matching build assignment', () => {
  assert.equal(isAssignedNextRole(valid), true);
  assert.equal(isAssignedNextRole({...valid, roles: ['ADMIN']}), false);
  assert.equal(isAssignedNextRole({...valid, assignments: []}), false);
  assert.equal(isAssignedNextRole({...valid, userId: 'someone-else'}), false);
  assert.equal(isAssignedNextRole({...valid, role: 'AUDITOR'}), false);
});
test('supports persona_role responses without treating other assignments as permission', () => {
  assert.equal(isAssignedNextRole({...valid, assignments: [{ user_id: 'me', persona_role: 'DATA_OWNER' }]}), true);
  assert.equal(isAssignedNextRole({...valid, assignments: [{ user_id: 'other', persona_role: 'DATA_OWNER' }]}), false);
});
test('fails closed for missing or malformed context', () => {
  for (const override of [{userId: null}, {role: null}, {roles: null}, {assignments: null}, {roles: []}]) {
    assert.equal(isAssignedNextRole({...valid, ...override}), false);
  }
});
