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

import React, { useEffect, useRef, useState } from 'react';
import {
  Button, Checkbox, InlineNotification, Modal, PasswordInput,
  RadioButton, RadioButtonGroup, TextArea, TextInput,
} from '@carbon/react';
import { DocumentAdd, TrashCan } from '@carbon/icons-react';
import secretStoreService from '../services/secretStoreService';
import { useConfigStore } from '../store/configStore';
import { secretErrorMessage } from '../utils/secretStore';

export function SecretError({ error }) {
  return error ? <InlineNotification kind="error" title="Unable to complete this action" subtitle={secretErrorMessage(error)} hideCloseButton lowContrast /> : null;
}

export function SecretMetadataModal({ object, kind, onClose, onSaved }) {
  const [alias, setAlias] = useState(object?.alias || '');
  const [description, setDescription] = useState(object?.description || '');
  const [archived, setArchived] = useState(object?.archived || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    if (busy) return; setBusy(true); setError(null);
    try {
      const result = object
        ? await secretStoreService.update(object.id, { alias, description, archived, expected_revision: object.revision })
        : await secretStoreService.create({ kind, alias, description });
      onSaved(result);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return <Modal open modalHeading={object ? 'Edit entry details' : kind === 'GROUP' ? 'Create secret group' : 'Create secret entry'}
    primaryButtonText={busy ? 'Saving…' : 'Save entry'} secondaryButtonText="Cancel"
    primaryButtonDisabled={busy || !alias.trim() || alias.length > 100 || description.length > 1000}
    onRequestClose={() => !busy && onClose()} onRequestSubmit={save}>
    <div className="secret-store__form">
      <SecretError error={error} />
      <p>Entries stay neutral. Runtime secret types are approved later in the build flow.</p>
      <TextInput id="secret-alias" labelText="Alias" value={alias} maxLength={100} disabled={busy} onChange={e => setAlias(e.target.value)} autoComplete="off" data-modal-primary-focus />
      <TextArea id="secret-description" labelText="Description (optional)" value={description} maxLength={1000} disabled={busy} onChange={e => setDescription(e.target.value)} />
      {object && <Checkbox id="secret-archived" labelText="Archive entry" checked={archived} disabled={busy} onChange={(_, { checked }) => setArchived(checked)} />}
      {object && <p className="secret-store__helper">Archiving prevents new use. Existing version references are retained.</p>}
    </div>
  </Modal>;
}

export function SecretImportModal({ object, version, onClose, onSaved }) {
  const serverUrl = useConfigStore(s => s.serverUrl);
  const [key, setKey] = useState(null);
  const [trust, setTrust] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sealed, setSealed] = useState(false);
  const reserved = useRef(version || null);
  const envelope = useRef(null);
  useEffect(() => {
    let current = true;
    (async () => {
      if (!window.electron?.crypto?.sealSecretImport) throw new Error('Open the desktop app to import secret values securely.');
      const info = await secretStoreService.importKey();
      const status = await window.electron.crypto.secretImportStatus({ serverUrl, info });
      if (current) { setKey(info); setTrust(status); }
    })().catch(e => { if (current) setError(e); });
    return () => { current = false; envelope.current = null; };
  }, [serverUrl]);
  const trustKey = async () => {
    setBusy(true); setError(null);
    try { setTrust(await window.electron.crypto.trustSecretImportKey({ serverUrl, info: key, confirmedFingerprint: key.fingerprint })); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  const chooseFile = async () => {
    try { const selected = await window.electron.crypto.chooseSecretImportFile(); if (selected) setFile(selected); }
    catch (e) { setError(e); }
  };
  const save = async () => {
    if (busy) return; setBusy(true); setError(null);
    try {
      if (!envelope.current) {
        if (!reserved.current) reserved.current = await secretStoreService.reserve(object.id);
        envelope.current = await window.electron.crypto.sealSecretImport({
          serverUrl, info: key, secretId: object.id, versionId: reserved.current.id,
          ...(mode === 'file' ? { filePath: file.path } : { text }),
        });
        setText(''); setFile(null); setSealed(true);
      }
      await secretStoreService.upload(object.id, reserved.current.id, envelope.current);
      envelope.current = null; onSaved();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return <Modal open modalHeading={version ? `Complete version ${version.version}` : `Add encrypted version — ${object.alias}`}
    primaryButtonText={busy ? 'Encrypting and saving…' : sealed ? 'Retry encrypted upload' : 'Encrypt and save version'} secondaryButtonText="Cancel"
    primaryButtonDisabled={busy || !trust?.trusted || (!sealed && mode === 'file' && !file) || !key}
    onRequestClose={() => !busy && onClose()} onRequestSubmit={save}>
    <div className="secret-store__form">
      <SecretError error={error} />
      <p>The value is encrypted in the desktop app and verified by the private import service. It cannot be revealed afterwards. Maximum size: 64 KiB.</p>
      {key && !trust?.trusted && <div className="secret-store__trust">
        <InlineNotification kind={trust?.changed ? 'warning' : 'info'} title={trust?.changed ? 'Import key changed' : 'Verify the import key'}
          subtitle="Compare this fingerprint with the one supplied by your platform administrator before trusting it." hideCloseButton lowContrast />
        <code className="secret-store__fingerprint">{key.fingerprint}</code>
        <Checkbox id="secret-confirm-key" labelText="I verified the complete fingerprint with the platform administrator." checked={confirmed}
          onChange={(_, { checked }) => setConfirmed(checked)} disabled={busy} />
        <Button kind="tertiary" size="sm" disabled={!confirmed || busy} onClick={trustKey}>Trust this import key</Button>
      </div>}
      {trust?.trusted && <p className="secret-store__helper">Import key verified for this server on this device.</p>}
      {!sealed && <>
        <RadioButtonGroup name="secret-source" legendText="Value source" valueSelected={mode} onChange={value => { setMode(value); setText(''); setFile(null); }} disabled={busy}>
          <RadioButton id="secret-source-text" labelText="Text value" value="text" />
          <RadioButton id="secret-source-file" labelText="File" value="file" />
        </RadioButtonGroup>
        {mode === 'text'
          ? <PasswordInput id="secret-value" labelText="New value" value={text} onChange={e => setText(e.target.value)} disabled={busy}
              autoComplete="new-password" helperText="Leading and trailing spaces are preserved. Use a file for binary or multiline values. An empty value is allowed." />
          : <div className="secret-store__file">
              <Button kind="tertiary" renderIcon={DocumentAdd} onClick={chooseFile} disabled={busy || !window.electron?.crypto?.chooseSecretImportFile}>Choose value file</Button>
              {file && <div className="secret-store__file-selection"><span>{file.name} · {file.size} bytes</span>
                <Button hasIconOnly kind="ghost" renderIcon={TrashCan} iconDescription="Remove selected file" disabled={busy} onClick={() => setFile(null)} /></div>}
            </div>}
      </>}
      {sealed && <p>The plaintext has been cleared from this form. Retrying sends the same encrypted package.</p>}
    </div>
  </Modal>;
}
