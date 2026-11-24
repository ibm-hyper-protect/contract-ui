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

import { load, dump, JSON_SCHEMA } from 'js-yaml';

// Add public references to the Environment template, never catalog values or
// workload container definitions. The backend repeats and enforces this merge.
export function environmentTemplateWithSecrets(content, flow) {
  if (!flow?.prepared || !flow.artifacts?.length) return content;
  const section = load(content, { schema: JSON_SCHEMA });
  if (!section || section.type !== 'env') throw new Error('Expected an environment template.');
  if (section.env !== undefined && (!section.env || typeof section.env !== 'object' || Array.isArray(section.env)))
    throw new Error('Environment variables must be a mapping.');
  const variables = { ...section.env };
  for (const artifact of flow.artifacts) {
    const name = `${artifact.name}_SECRET_ID`;
    if (Object.hasOwn(variables, name) && variables[name] !== artifact.secret_id)
      throw new Error(`Environment variable ${name} conflicts with the approved UV secret ID.`);
    variables[name] = artifact.secret_id;
  }
  section.env = variables;
  return dump(section, { noRefs: true, lineWidth: -1, forceQuotes: true });
}

// Serialize only purpose-bound public references; never private catalog metadata.
export function prepareSecretBindings(candidates, mapping, requirements) {
  if (candidates.length > 8)
    throw new Error('This runtime supports at most eight requests after group expansion.');
  const names = new Set();
  const versions = new Set();
  const objects = new Set();
  return candidates.map((candidate) => {
    const requirement = requirements.find((r) => r.name === mapping[candidate.version_id]);
    if (!requirement) throw new Error('Map every selected version to a declared requirement.');
    if (
      names.has(requirement.name) ||
      versions.has(candidate.version_id) ||
      (candidate.secret_id && objects.has(candidate.secret_id))
    ) {
      throw new Error('Choose one distinct secret version for each logical requirement.');
    }
    names.add(requirement.name);
    versions.add(candidate.version_id);
    if (candidate.secret_id) objects.add(candidate.secret_id);
    return {
      name: requirement.name,
      consumer: requirement.consumer,
      kind: requirement.kind,
      type: requirement.type,
      version_id: candidate.version_id,
      ...(candidate.group_revision_id ? { group_revision_id: candidate.group_revision_id } : {}),
    };
  });
}
export function secretRuntimeProfile(flow) {
  return flow?.requirements?.length ? 'ccrv' : 'ccrt';
}

// Ordinary builds, including those from older Managers, need no catalog lookup.
// Once the backend advertises secrets, every failure remains visible and strict
// catalog transport applies. Section submission is checked authoritatively again.
export async function requiredSecretFlow(build, load) {
  if (!build?.secret_flow_required) return null;
  return load();
}
