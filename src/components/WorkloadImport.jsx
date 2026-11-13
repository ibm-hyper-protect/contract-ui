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

import React, { useEffect, useRef, useState } from 'react';
import { Checkbox, FileUploaderDropContainer, FileUploaderItem, InlineNotification, Modal, RadioButton, RadioButtonGroup, Stack } from '@carbon/react';
import VolumeFields from './VolumeFields';

/** Prepare selected files locally, then open the existing YAML review. */
export default function WorkloadImport({ onClose, onApply }) {
  const [format, setFormat] = useState('compose');
  const [files, setFiles] = useState([]);
  const [addVolume, setAddVolume] = useState(false);
  const [volumes, setVolumes] = useState([{ id: 0, name: 'data', mount: '/mnt/data', seed: '' }]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => () => { ++sequence.current; }, []);
  const disabled = busy || reading;
  async function readFiles(selected) {
    if (!selected.length || disabled) return;
    const request = ++sequence.current;
    setError('');
    setReading(true);
    try {
      const all = [...files, ...selected];
      if (all.length > 32 || new Set(all.map(item => item.name)).size !== all.length) {
        throw new Error('Choose up to 32 files with unique names. Remove a selected file before replacing it.');
      }
      if (selected.some(item => !/\.ya?ml$/i.test(item.name) || !item.size || item.size > 1024 * 1024) ||
          all.reduce((sum, item) => sum + item.size, 0) > 5 * 1024 * 1024) {
        throw new Error('Choose non-empty YAML files, each up to 1 MB and up to 5 MB in total.');
      }
      const added = await Promise.all(selected.map(async item => ({ name: item.name, size: item.size, content: await item.text() })));
      if (request === sequence.current) setFiles([...files, ...added]);
    } catch (failure) { if (request === sequence.current) setError(failure.message || 'Unable to read the selected files.'); }
    finally { if (request === sequence.current) setReading(false); }
  }
  async function prepare() {
    if (!files.length || disabled) return;
    setBusy(true); setError('');
    try {
      if (!window.electron?.workload?.prepare) throw new Error('Workload import requires the Electron desktop application.');
      const result = await window.electron.workload.prepare({
        format, files: files.map(({ name, content }) => ({ name, content })),
        volumes: addVolume ? volumes.map(({ name, mount, seed }) => ({ name, mount, seed })) : [],
      });
      onApply(result.plaintext);
    } catch (failure) { setError(failure.message || 'Unable to prepare the workload.'); }
    finally { setBusy(false); }
  }
  return <Modal open size="lg" modalHeading="Import Docker Compose / Podman Play" modalLabel="Workload preparation"
    primaryButtonText={busy ? 'Preparing…' : 'Review workload YAML'} secondaryButtonText="Cancel"
    primaryButtonDisabled={!files.length || disabled || (addVolume && (!volumes.length || volumes.some(item => !item.name.trim() || !item.mount.trim() || !item.seed.trim())))}
    onRequestSubmit={prepare} onRequestClose={() => { if (!busy) onClose(); }} onSecondarySubmit={() => { if (!busy) onClose(); }} preventCloseOnClickOutside>
    <Stack gap={5}>
      <RadioButtonGroup name="workload-import-format" legendText="Definition format" valueSelected={format} disabled={disabled}
        onChange={value => { setFormat(value); setError(''); }}>
        <RadioButton id="import-compose" value="compose" labelText="Docker Compose" />
        <RadioButton id="import-play" value="play" labelText="Podman Play" />
      </RadioButtonGroup>
      <p>{format === 'compose'
        ? 'Upload self-contained Compose definitions. Services and other named entries must be distinct across files. The app creates one docker-compose.yaml tar.gz archive and adds its Base64 representation to compose.archive.'
        : 'Upload Pod and ConfigMap YAML files, including multi-document files. The app adds every document to play.resources in file order. No archive or manual Base64 encoding is needed.'}</p>
      <FileUploaderDropContainer labelText={format === 'compose' ? 'Choose Docker Compose YAML files' : 'Choose Podman Play YAML files'} accept={['.yaml', '.yml']}
        multiple disabled={disabled} onAddFiles={(_, { addedFiles }) => readFiles(addedFiles)} />
      <p>Up to 32 files, 1 MB per file and 5 MB total. Files selected later are appended.</p>
      {files.map(file => <FileUploaderItem key={file.name} name={file.name} status="edit" size="md" disabled={disabled}
        iconDescription="Remove file" onDelete={() => { if (!disabled) { setFiles(items => items.filter(item => item.name !== file.name)); setError(''); } }} />)}
      {reading && <p role="status">Reading selected files…</p>}
      <p>{format === 'compose'
        ? 'Push images first and resolve .env substitutions and local file references. For Compose overrides, import the resolved output of docker compose config. Absolute bind paths refer to the guest.'
        : 'Push images first. Include referenced ConfigMaps in the selected files. Absolute hostPath mounts refer to the guest.'}</p>
      <Checkbox id="workload-import-volumes" labelText="Add ext4 persistent volumes" checked={addVolume}
        disabled={disabled} onChange={(_, { checked }) => setAddVolume(checked)} />
      {addVolume && <VolumeFields volumes={volumes} onChange={setVolumes} disabled={disabled} />}
      {error && <InlineNotification kind="error" title="Workload could not be imported" subtitle={error} hideCloseButton lowContrast />}
    </Stack>
  </Modal>;
}
