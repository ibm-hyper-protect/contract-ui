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
import {
  environmentTemplateWithSecrets,
  prepareSecretBindings,
  secretRuntimeProfile,
  requiredSecretFlow,
} from '../src/utils/secretFlow.js';
import { load } from 'js-yaml';
const requirement = {
  name: 'DATABASE_PASSWORD',
  consumer: 'api',
  kind: 'retrievable',
  type: 'plain',
};
test('Environment template contains public UV references and preserves configuration', () => {
  const content = 'type: env\nenv:\n  APP_MODE: test\nlogging:\n  logRouter:\n    hostname: logs.example.test\n';
  const id = '0x' + 'ab'.repeat(32);
  const flow = { prepared: true, artifacts: [{ name: 'DATABASE_PASSWORD', secret_id: id, value: 'never', ciphertext: 'never' }] };
  const output = environmentTemplateWithSecrets(content, flow);
  const env = load(output);
  assert.deepEqual(env.env, { APP_MODE: 'test', DATABASE_PASSWORD_SECRET_ID: id });
  assert.equal(env.logging.logRouter.hostname, 'logs.example.test');
  assert.ok(!output.includes('never'));
  assert.equal(environmentTemplateWithSecrets(output, flow), output);
  assert.equal(environmentTemplateWithSecrets(content, null), content);
  assert.equal(environmentTemplateWithSecrets(content, { ...flow, prepared: false }), content);
  assert.throws(() => environmentTemplateWithSecrets('type: workload\n', flow), /environment template/);
  assert.throws(() => environmentTemplateWithSecrets('type: env\nenv: []\n', flow), /mapping/);
  assert.throws(() => environmentTemplateWithSecrets('type: env\nenv:\n  DATABASE_PASSWORD_SECRET_ID: wrong\n', flow), /conflicts/);
});
test('owner approval preserves pinned versions/group provenance and sends no private metadata', () => {
  const bindings = prepareSecretBindings(
    [
      {
        version_id: 'v2',
        group_revision_id: 'g3',
        alias: 'private',
        owner_id: 'someone',
        ciphertext: 'sealed',
        secret: 'never',
      },
    ],
    { v2: requirement.name },
    [requirement]
  );
  assert.deepEqual(bindings, [{ ...requirement, version_id: 'v2', group_revision_id: 'g3' }]);
  assert.deepEqual(prepareSecretBindings([], {}, [requirement]), []);
});
test('group expansion, incomplete mapping and duplicate consumer requirements block approval', () => {
  assert.throws(() => prepareSecretBindings(Array(9).fill({}), {}, [requirement]), /eight/);
  assert.throws(
    () => prepareSecretBindings([{ version_id: 'v1' }], {}, [requirement]),
    /Map every/
  );
  assert.throws(
    () =>
      prepareSecretBindings(
        [{ version_id: 'v1' }, { version_id: 'v2' }],
        { v1: requirement.name, v2: requirement.name },
        [requirement]
      ),
    /distinct/
  );
});
test('secret flow uses CCRV validation/templates while builds without secrets keep CCRT', () => {
  assert.equal(secretRuntimeProfile(null), 'ccrt');
  assert.equal(secretRuntimeProfile({ requirements: [] }), 'ccrt');
  assert.equal(
    secretRuntimeProfile({ requirements: [requirement], target: { mode: 'SIMULATION' } }),
    'ccrv'
  );
  assert.equal(
    secretRuntimeProfile({ requirements: [requirement], target: { mode: 'NATIVE' } }),
    'ccrv'
  );
});

test('ordinary and older builds need no catalog request; secret-build failures stay visible', async () => {
  let calls = 0;
  const unexpected = async () => {
    calls++;
    throw new Error('Catalog query was not needed');
  };
  assert.equal(await requiredSecretFlow({}, unexpected), null);
  assert.equal(await requiredSecretFlow({ secret_flow_required: false }, unexpected), null);
  assert.equal(calls, 0);
  for (const status of [401, 403, 404, 409, 422, 500, 503]) {
    const error = { status };
    await assert.rejects(
      requiredSecretFlow({ secret_flow_required: true }, async () => {
        throw error;
      }),
      (e) => e === error
    );
  }
  const flow = { requirements: [{ name: 'PASSWORD' }] };
  assert.equal(await requiredSecretFlow({ secret_flow_required: true }, async () => flow), flow);
});
