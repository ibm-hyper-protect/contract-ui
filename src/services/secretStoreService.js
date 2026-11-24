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

import apiClient from './apiClient';
import { assertSecretTransport } from '../utils/secretTransport';
import { requiredSecretFlow } from '../utils/secretFlow';

const base = '/secret-store/objects';
const result = (response) => response.data;
const request = (method, path, data) =>
  Promise.resolve()
    .then(() => {
      assertSecretTransport(apiClient.getBaseURL());
      return apiClient[method](path, data);
    })
    .then(result);
const secretStoreService = {
  flow: (buildId) => request('get', `/builds/${buildId}/secret-flow`),
  flowForBuild: (buildId, build) =>
    requiredSecretFlow(build, () => request('get', `/builds/${buildId}/secret-flow`)),
  targets: () => request('get', '/secret-store/targets'),
  target: (buildId, data) => request('put', `/builds/${buildId}/secret-flow/target`, data),
  requirements: (buildId, data) =>
    request('put', `/builds/${buildId}/secret-flow/requirements`, data),
  approveTarget: (buildId, data) =>
    request('put', `/builds/${buildId}/secret-flow/target-approval`, data),
  approveSources: (buildId, data) =>
    request('put', `/builds/${buildId}/secret-flow/approvals`, data),
  prepare: (buildId, data) =>
    Promise.resolve()
      .then(() => {
        assertSecretTransport(apiClient.getBaseURL());
        return apiClient.post(`/builds/${buildId}/secret-flow/prepare`, data, { timeout: 240000 });
      })
      .then(result),
  list: (kind = 'SECRET', offset = 0, limit = 50, search = '') =>
    request('get', base, { params: { kind, offset, limit, search } }),
  detail: (id) => request('get', `${base}/${id}`),
  create: (data) => request('post', base, data),
  update: (id, data) => request('patch', `${base}/${id}`, data),
  importKey: () => request('get', '/secret-store/import-key'),
  reserve: (id) => request('post', `${base}/${id}/versions`, {}),
  upload: (id, versionId, envelope) =>
    request('put', `${base}/${id}/versions/${versionId}/payload`, envelope),
  groupRevision: (id, data) => request('post', `${base}/${id}/revisions`, data),
  buildSources: (buildId) => request('get', `/builds/${buildId}/secret-sources`),
  setBuildSources: (buildId, data) => request('put', `/builds/${buildId}/secret-sources`, data),
};
export default secretStoreService;
