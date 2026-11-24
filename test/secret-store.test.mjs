// Copyright (c) 2026 IBM Corp.
// All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseSecretStore, isPreparationMutable, sourceReferences } from '../src/utils/secretStore.js';

test('personal secrets are available to every contributing role, excluding Viewer and unknown roles', () => {
  for (const role of ['ADMIN', 'AUDITOR', 'SOLUTION_PROVIDER', 'DATA_OWNER', 'ENV_OPERATOR']) {
    assert.equal(canUseSecretStore(role), true, role);
  }
  for (const role of ['VIEWER', undefined, null, '', 'UNKNOWN']) {
    assert.equal(canUseSecretStore(role), false);
  }
});

test('source submission preserves pinned group references and sends no catalog values or ownership claims', () => {
  assert.deepEqual(sourceReferences([
    { version_id: 'one', group_revision_id: 'group-v2', owner_id: 'other', ciphertext: 'private', alias: 'database' },
    { version_id: 'two', group_revision_id: null, secret: 'never send this' },
  ]), [{ version_id: 'one', group_revision_id: 'group-v2' }, { version_id: 'two' }]);
  assert.equal(isPreparationMutable('CREATED'), true);
  assert.equal(isPreparationMutable('SIGNING_KEY_REGISTERED'), true);
  for (const status of ['WORKLOAD_SUBMITTED', 'FINALIZED', 'CONTRACT_DOWNLOADED', 'CANCELLED', 'UNKNOWN']) {
    assert.equal(isPreparationMutable(status), false);
  }
});
