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

import React, { useRef, useState } from 'react';
import { Checkbox, FileUploaderDropContainer, InlineNotification, Modal, PasswordInput, Stack, TextInput } from '@carbon/react';

/** Import one self-contained Compose definition into the existing YAML review. */
export default function ComposeWorkloadImport({ onClose, onApply }) {
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [addVolume, setAddVolume] = useState(false);
  const [name, setName] = useState('data');
  const [mount, setMount] = useState('/mnt/data');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const prefix = 'compose-import';
  async function readFile(selected) {
    if (!selected || busy) return;
    const request = ++sequence.current;
    setError(''); setFile(null); setContent('');
    if (!/\.ya?ml$/i.test(selected.name) || !selected.size || selected.size > 1024 * 1024) {
      setError('Choose a non-empty Compose .yaml or .yml file no larger than 1 MB.'); return;
    }
    try {
      const text = await selected.text();
      if (request === sequence.current) { setContent(text); setFile(selected.name); }
    } catch { if (request === sequence.current) setError('Unable to read the Compose file. Choose it again.'); }
  }
  async function prepare() {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      if (!window.electron?.workload?.prepareCompose) throw new Error('Compose import requires the Electron desktop application.');
      const result = await window.electron.workload.prepareCompose({
        content, volume: addVolume ? { name, mount, seed } : null,
      });
      onApply(result.plaintext);
    } catch (failure) { setError(failure.message || 'Unable to prepare the workload.'); }
    finally { setBusy(false); }
  }
  return <Modal open size="lg" modalHeading="Import Docker Compose" modalLabel="Workload preparation"
    primaryButtonText={busy ? 'Preparing…' : 'Review workload YAML'} secondaryButtonText="Cancel"
    primaryButtonDisabled={!file || busy || (addVolume && !seed.trim())}
    onRequestSubmit={prepare} onRequestClose={() => { if (!busy) onClose(); }} onSecondarySubmit={() => { if (!busy) onClose(); }} preventCloseOnClickOutside>
    <Stack gap={5}>
      <p>Upload a self-contained Compose file. The app packages it as docker-compose.yaml in a tar.gz archive and adds its Base64 representation to the workload.</p>
      <FileUploaderDropContainer labelText="Choose a Docker Compose YAML file" accept={['.yaml', '.yml']}
        disabled={busy} onAddFiles={(_, { addedFiles }) => readFile(addedFiles[0])} />
      {file && <p role="status">Selected: {file}</p>}
      <p>Push images before importing. Resolve .env substitutions and local file references first. Absolute bind paths refer to the guest, not this computer.</p>
      <Checkbox id={prefix + '-volume'} labelText="Add an ext4 persistent volume" checked={addVolume}
        disabled={busy} onChange={(_, { checked }) => setAddVolume(checked)} />
      {addVolume && <>
        <TextInput id={prefix + '-name'} labelText="Volume name" value={name} disabled={busy} onChange={event => setName(event.target.value)} helperText="Use the same name in the environment section." />
        <TextInput id={prefix + '-mount'} labelText="Guest mount path" value={mount} disabled={busy} onChange={event => setMount(event.target.value)} helperText="Match the absolute bind path in Compose, for example /mnt/data." />
        <PasswordInput id={prefix + '-seed'} labelText="Workload volume seed" value={seed} disabled={busy} onChange={event => setSeed(event.target.value)} autoComplete="off" helperText="For existing data, retain the original workload seed and the original environment seed. This importer does not generate or replace seeds." />
      </>}
      {error && <InlineNotification kind="error" title="Compose could not be imported" subtitle={error} hideCloseButton lowContrast />}
    </Stack>
  </Modal>;
}
