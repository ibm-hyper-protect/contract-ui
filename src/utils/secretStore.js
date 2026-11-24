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

import { BUILD_STATUS } from './constants';

export const canUseSecretStore = role => ['ADMIN', 'AUDITOR', 'SOLUTION_PROVIDER', 'DATA_OWNER', 'ENV_OPERATOR'].includes(role);
export const isPreparationMutable = status => [BUILD_STATUS.CREATED, BUILD_STATUS.SIGNING_KEY_REGISTERED].includes(status);
export const secretErrorMessage = error => error?.message || 'The secret store request could not be completed.';
export const sourceReferences = sources => sources.map(({ version_id, group_revision_id }) => ({
  version_id,
  ...(group_revision_id ? { group_revision_id } : {}),
}));
