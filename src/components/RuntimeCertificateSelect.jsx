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

import React, { useEffect, useState } from 'react';
import { Button, InlineLoading, InlineNotification, Select, SelectItem } from '@carbon/react';
import runtimeCertificateService from '../services/runtimeCertificateService';
import { useConfigStore } from '../store/configStore';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/formatters';
import '../styles/runtime-certificate-select.scss';

/** Shared platform/version picker; only current, supported certificates reach the form. */
export default function RuntimeCertificateSelect({ id, disabled = false, onChange }) {
  const serverUrl = useConfigStore(state => state.serverUrl);
  const token = useAuthStore(state => state.token);
  const [platforms, setPlatforms] = useState(null);
  const [platform, setPlatform] = useState('');
  const [version, setVersion] = useState('');
  const [certificate, setCertificate] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [certificateError, setCertificateError] = useState('');
  const [loadingCertificate, setLoadingCertificate] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [certificateRetry, setCertificateRetry] = useState(0);
  const selected = platforms?.find(item => item.id === platform);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    onChange(null);
    setPlatforms(null);
    setPlatform('');
    setVersion('');
    setCertificate(null);
    setCatalogError('');
    runtimeCertificateService.getPlatforms(controller.signal).then(result => {
      if (active) setPlatforms(result);
    }).catch(error => {
      if (active) setCatalogError(error.message || 'Unable to load runtime platforms.');
    });
    return () => { active = false; controller.abort(); onChange(null); };
  }, [serverUrl, token, catalogRetry, onChange]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    onChange(null);
    setCertificate(null);
    setCertificateError('');
    setLoadingCertificate(false);
    if (selected && selected.versions.includes(version)) {
      setLoadingCertificate(true);
      runtimeCertificateService.getCertificate(platform, version, controller.signal).then(result => {
        if (!active) return;
        setCertificate(result);
        if (selected.contract_supported && result.contract_supported) onChange(result);
      }).catch(error => {
        if (active) setCertificateError(error.message || 'Unable to load this runtime certificate.');
      }).finally(() => { if (active) setLoadingCertificate(false); });
    }
    return () => { active = false; controller.abort(); };
  }, [selected, platform, version, certificateRetry, serverUrl, token, onChange]);

  const clearChoice = () => { onChange(null); setCertificate(null); setCertificateError(''); };
  return (
    <div className="runtime-certificate-select">
      {!platforms && !catalogError && <InlineLoading description="Loading runtime platforms…" />}
      {catalogError && (
        <>
          <InlineNotification kind="error" title="Runtime platforms unavailable" subtitle={catalogError} hideCloseButton lowContrast />
          <Button kind="ghost" size="sm" disabled={disabled} onClick={() => setCatalogRetry(value => value + 1)}>Retry platforms</Button>
        </>
      )}
      {platforms?.length === 0 && <p className="submission-form__help">No runtime certificates are available. Upload a custom certificate.</p>}
      {!!platforms?.length && (
        <div className="submission-form__selects">
          <Select id={id + '-platform'} labelText="Platform" value={platform} disabled={disabled}
            onChange={event => { clearChoice(); setPlatform(event.target.value); setVersion(''); }}>
            <SelectItem value="" text="Choose a platform" />
            {platforms.map(item => <SelectItem key={item.id} value={item.id} text={item.id.toUpperCase()} />)}
          </Select>
          <Select id={id + '-version'} labelText="Certificate version" value={version} disabled={disabled || !selected?.versions.length}
            onChange={event => { clearChoice(); setVersion(event.target.value); }}>
            <SelectItem value="" text="Choose a version" />
            {selected?.versions.map(item => <SelectItem key={item} value={item} text={item} />)}
          </Select>
        </div>
      )}
      {selected && !selected.contract_supported && (
        <InlineNotification kind="warning" title="Contract platform not supported"
          subtitle="This platform is present in the certificate library, but the backend does not support its contract workflow. Its certificates cannot be submitted here."
          hideCloseButton lowContrast />
      )}
      {selected && !selected.versions.length && <p className="submission-form__help">No certificate versions are available for this platform.</p>}
      {loadingCertificate && <InlineLoading description="Loading runtime certificate…" />}
      {certificateError && (
        <>
          <InlineNotification kind="error" title="Runtime certificate unavailable" subtitle={certificateError} hideCloseButton lowContrast />
          <Button kind="ghost" size="sm" disabled={disabled} onClick={() => setCertificateRetry(value => value + 1)}>Retry certificate</Button>
        </>
      )}
      {certificate && (
        <div className="runtime-certificate-select__metadata" role="status">
          <p>{certificate.name} · Expires {formatDate(certificate.not_after)}</p>
          <p>SHA-256: <code>{certificate.fingerprint_sha256}</code></p>
          <p>Choose the version installed on your runtime and use the same certificate for every section.</p>
        </div>
      )}
    </div>
  );
}
