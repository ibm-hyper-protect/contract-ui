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

import React from 'react';
import { Accordion, AccordionItem, CodeSnippet } from '@carbon/react';
import '../styles/contract-input-help.scss';

const WORKLOAD = `type: workload
compose:
  archive: REPLACE_WITH_BASE64_TAR_GZ
volumes:
  data:
    mount: /mnt/data
    filesystem: ext4
    seed: REPLACE_WITH_WORKLOAD_VOLUME_SEED`;
const ENVIRONMENT = `type: env
auths:
  registry.example:
    username: REPLACE_WITH_REGISTRY_USERNAME
    password: REPLACE_WITH_REGISTRY_TOKEN
volumes:
  data:
    seed: REPLACE_WITH_ENVIRONMENT_VOLUME_SEED`;

/** Explain input provenance without supplying or generating deployment secrets. */
export default function ContractInputHelp({ section }) {
  const keys = section === 'keys';
  const workload = section === 'workload';
  return (
    <Accordion className="contract-input-help" aria-label="Contract input guidance">
      {!keys && <AccordionItem title={workload ? 'Preparing workload YAML' : 'Preparing environment YAML'}>
        {workload ? <>
          <p>Your application documentation defines the image, ports, environment variables and persistent paths. Put these in a Docker Compose file.</p>
          <p>For <code>compose.archive</code>, place <code>docker-compose.yaml</code> at the root of a tar.gz archive and Base64-encode it. Base64 is an encoding; the section is encrypted when submitted.</p>
          <p>Get the image tag or digest from your registry. Include files referenced by Compose in the archive; files on your laptop are not automatically available in the guest.</p>
        </> : <>
          <p>Get registry credentials from your registry or IAM administrator. For IBM Cloud Container Registry, use <code>iamapikey</code> as the username and an authorized API key as the password.</p>
          <p>Get the complete syslog block from your log receiver operator: hostname, port, CA certificate (<code>server</code>), client certificate (<code>cert</code>) and client private key (<code>key</code>). These differ from the runtime encryption certificate uploaded below.</p>
        </>}
        <CodeSnippet type="multi" wrapText>{workload ? WORKLOAD : ENVIRONMENT}</CodeSnippet>
        <p>This example contains placeholders. Replace them with your deployment values before submitting.</p>
      </AccordionItem>}
      {!keys && <AccordionItem title="Persistent volumes and existing data">
        <p>Use the same volume name in workload and environment, for example <code>data</code>. The workload declares its mount path and filesystem. Each section supplies its own seed.</p>
        <p>Generate and securely retain seeds for a new volume according to your runtime documentation. For an existing encrypted volume, preserve both original seeds. Changing either can make existing data inaccessible.</p>
        <p>The runtime mount must match the host-side path in Compose, for example <code>/mnt/data/postgres:/var/lib/postgresql/data</code>.</p>
      </AccordionItem>}
      <AccordionItem title={keys ? 'Signing, attestation and runtime encryption' : 'Choosing the runtime encryption certificate'}>
        <p>Get the public encryption certificate from your trusted runtime provider, matched to your target platform and version. Use that same certificate for workload, environment and attestation-key encryption.</p>
        <p>A fingerprint identifies a certificate; it does not prove its source is trusted. The runtime holds the corresponding private key.</p>
        {keys && <>
          <p>The signing passphrase protects the build signing key. Enter that same passphrase when finalising the contract. The attestation passphrase protects the separate attestation key. Neither is your account password or a volume seed.</p>
          <p>Registering an attestation key prepares the contract. Verifying evidence from a running guest is a later, separate step.</p>
        </>}
      </AccordionItem>
    </Accordion>
  );
}
