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

import apiClient from './apiClient';
import { parseCertificateCatalog, parseRuntimeCertificate } from '../utils/runtimeCertificates';

/** Load the backend library's platform/version catalog using normal authenticated requests. */
async function getPlatforms(signal) {
  const response = await apiClient.get('/v2/encryption-certificates/versions', { signal });
  return parseCertificateCatalog(response.data);
}

/** Fetch the genuine embedded certificate for an exact platform/version pair. */
async function getCertificate(platform, version, signal) {
  const response = await apiClient.get('/v2/encryption-certificates/certificate', {
    params: { platform, version },
    signal,
  });
  return parseRuntimeCertificate(response.data, platform, version);
}

export default { getPlatforms, getCertificate };
