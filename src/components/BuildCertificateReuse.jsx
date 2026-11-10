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
import { Button, InlineNotification } from '@carbon/react';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { useBuildCertificateStore } from '../store/buildCertificateStore';
import '../styles/build-certificate-reuse.scss';

/** Explicit reuse never submits a section or changes encryption/signing behavior. */
export default function BuildCertificateReuse({ buildId, content, name, disabled, onSelect }) {
  const userId = useAuthStore(state => state.user?.id);
  const token = useAuthStore(state => state.token);
  const serverUrl = useConfigStore(state => state.serverUrl);
  const scope = userId && token && buildId ? JSON.stringify([serverUrl, userId, buildId]) : '';
  const remembered = useBuildCertificateStore(state => state.entries[scope]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const context = useRef(null);
  const alive = useRef(true);
  context.current = { scope, content, token };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setError(''); }, [scope, content, token]);
  async function inspect(reuse) {
    if (!scope || disabled || busy) return;
    const initial = context.current;
    setBusy(true); setError('');
    try {
      if (!window.electron?.crypto?.inspectRuntimeCertificate) throw new Error('Certificate reuse requires the Electron desktop application.');
      const input = reuse ? remembered?.content : content;
      const result = await window.electron.crypto.inspectRuntimeCertificate(input);
      const current = context.current;
      if (!alive.current || !current || current.scope !== initial.scope || current.content !== initial.content || current.token !== initial.token ||
          useAuthStore.getState().token !== initial.token || useConfigStore.getState().serverUrl !== serverUrl) return;
      if (reuse) onSelect({ name: remembered.name, content: result.content });
      else useBuildCertificateStore.getState().remember(scope, { ...result, name: name || 'Runtime certificate' });
    } catch (failure) {
      if (alive.current && context.current?.scope === initial.scope && useAuthStore.getState().token === initial.token) setError(failure.message || 'Unable to inspect the certificate.');
    } finally { if (alive.current) setBusy(false); }
  }
  if (!scope) return null;
  return <div className="build-certificate-reuse">
    {remembered && <>
      <p><strong>Certificate remembered for this build</strong></p>
      <p>{remembered.name} · Expires {new Date(remembered.notAfter).toLocaleDateString()}</p>
      <p className="build-certificate-reuse__subject">{remembered.subject}</p>
      <p>SHA-256: <code>{remembered.fingerprint}</code></p>
      <p>Confirm this matches your trusted runtime certificate before reusing it.</p>
      <Button kind="tertiary" size="sm" disabled={disabled || busy} onClick={() => inspect(true)}>Use remembered certificate</Button>
      <Button kind="ghost" size="sm" disabled={disabled || busy} onClick={() => useBuildCertificateStore.getState().forget(scope)}>Forget certificate</Button>
    </>}
    {!!content && content.trim() !== remembered?.content?.trim() && <Button kind="ghost" size="sm" disabled={disabled || busy} onClick={() => inspect(false)}>
      {busy ? 'Checking certificate…' : 'Remember selected certificate for this build'}
    </Button>}
    <p>Optional, on this device during this session only. Only the public certificate is remembered; your next submission still requires review.</p>
    {error && <InlineNotification kind="error" title="Certificate could not be reused" subtitle={error} hideCloseButton lowContrast />}
  </div>;
}
