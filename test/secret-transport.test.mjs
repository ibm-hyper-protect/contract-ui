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
import { assertSecretTransport } from '../src/utils/secretTransport.js';
test('Secret Store requires HTTPS except for explicit loopback development and tunnels', () => {
  for (const value of ['https://contracts.example.test', 'http://127.0.0.1:18081', 'http://localhost:18081', 'http://[::1]:8080']) assert.doesNotThrow(() => assertSecretTransport(value));
  for (const value of ['http://contracts.example.test', 'http://9.30.1.159:8080', 'http://localhost.evil.example', 'http://localhost@evil.example', 'https://user:password@example.test', 'file:///tmp/test', 'https://example.test?token=x', 'https://example.test#x']) assert.throws(() => assertSecretTransport(value));
});
