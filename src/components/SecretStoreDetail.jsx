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

import React, { useEffect, useState } from 'react';
import { Button, DataTableSkeleton, InlineNotification, Modal, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, Tag, Tile } from '@carbon/react';
import { Add, ArrowLeft, Edit, Renew } from '@carbon/icons-react';
import PageHeader from './PageHeader';
import { SecretError, SecretImportModal, SecretMetadataModal } from './SecretStoreForms';
import SecretVersionPicker from './SecretVersionPicker';
import secretStoreService from '../services/secretStoreService';
import { useToast } from './ToastManager';

const date = value => new Date(value).toLocaleString();
export default function SecretStoreDetail({ objectId, onBack }) {
  const { showSuccess } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    secretStoreService.detail(objectId).then(value => { if (current) setData(value); })
      .catch(e => { if (current) { setError(e); setData(null); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [objectId, refresh]);
  const saved = message => { setModal(null); setRefresh(n => n + 1); showSuccess(message, 'No stored values are displayed.'); };
  const object = data?.object;
  const permissions = data?.permissions || {};
  return <div className="app-page secret-store">
    <PageHeader title={object?.alias || 'Entry details'} description={object?.description || 'Encrypted catalog entry'}
      navigation={<Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={onBack}>Back to secret store</Button>}
      actions={<><Button kind="ghost" renderIcon={Renew} onClick={() => setRefresh(n => n + 1)} disabled={loading}>Refresh</Button>
        {permissions.can_edit_metadata && <Button kind="tertiary" renderIcon={Edit} onClick={() => setModal({ type: 'metadata' })} disabled={loading}>Edit details</Button>}
        {permissions.can_write_versions && <Button renderIcon={Add} disabled={loading} onClick={() => setModal({ type: object.kind === 'GROUP' ? 'group' : 'import' })}>
          {object?.kind === 'GROUP' ? 'New group revision' : 'Add version'}</Button>}</>} />
    <SecretError error={error} />
    {loading && !object ? <DataTableSkeleton rowCount={4} columnCount={4} showToolbar={false} /> : object && <>
      <Tile className="secret-store__summary">
        <div className="secret-store__badges"><Tag size="sm" type="gray">{object.kind === 'GROUP' ? 'Secret group' : 'Neutral secret'}</Tag><Tag size="sm" type={object.archived ? 'gray' : 'blue'}>{object.archived ? 'Archived' : 'Active'}</Tag></div>
        <p className="secret-store__summary-description">{object.kind === 'GROUP' ? 'Personal groups pin exact versions of your secrets for bundled build selection.' : 'Values stay encrypted. The assigned Auditor chooses Retrievable or Association use when preparing runtime requests.'}</p>
        <dl className="secret-store__metadata">
          <div><dt>Catalog ID</dt><dd><code>{object.id}</code></dd></div>
          <div><dt>Created</dt><dd>{date(object.created_at)}</dd></div>
        </dl>
      </Tile>
      {object.kind === 'SECRET'
        ? <TableContainer title="Versions" description="Each completed version is immutable. Stored values cannot be revealed."><Table aria-label="Secret versions"><TableHead><TableRow>
            <TableHeader>Version</TableHeader><TableHeader>State</TableHeader><TableHeader>Size</TableHeader><TableHeader>Created</TableHeader><TableHeader>Action</TableHeader>
          </TableRow></TableHead><TableBody>
            {data.versions.map(v => <TableRow key={v.id}><TableCell>Version {v.version}</TableCell>
              <TableCell><Tag type={v.state === 'SEALED' ? 'green' : 'gray'}>{v.state === 'SEALED' ? 'Encrypted' : 'Upload incomplete'}</Tag></TableCell>
              <TableCell>{v.byte_length == null ? '—' : `${v.byte_length} bytes`}</TableCell><TableCell>{date(v.created_at)}</TableCell>
              <TableCell>{v.state === 'RESERVED' && permissions.can_write_versions ? <Button size="sm" kind="ghost" onClick={() => setModal({ type: 'import', version: v })}>Complete upload</Button> : '—'}</TableCell></TableRow>)}
            {!data.versions.length && <TableRow><TableCell colSpan={5}><div className="secret-store__empty"><strong>No versions yet</strong><p>Add the first encrypted value to make this entry available for preparation.</p></div></TableCell></TableRow>}
          </TableBody></Table></TableContainer>
        : <div className="secret-store__revisions"><h2>Group revisions</h2>
            {!data.revisions.length && <Tile><p>No revisions yet. Add encrypted versions to the store, then bundle them here.</p></Tile>}
            {data.revisions.map(r => <Tile key={r.id}><div className="secret-store__section-heading"><h3>Revision {r.revision}</h3><span>{date(r.created_at)}</span></div>
              <ul>{r.members.map(m => <li key={m.version_id}>{m.alias} — version {m.version}</li>)}</ul>
              {r.restricted_members > 0 && <p>{r.restricted_members} unavailable member(s) are excluded. Create a new revision with your own secrets.</p>}
            </Tile>)}
          </div>}

    </>}
    {modal?.type === 'metadata' && <SecretMetadataModal object={object} onClose={() => setModal(null)} onSaved={() => saved('Entry updated')} />}
    {modal?.type === 'import' && <SecretImportModal object={object} version={modal.version} onClose={() => { setModal(null); setRefresh(n => n + 1); }} onSaved={() => saved('Encrypted version saved')} />}
    {modal?.type === 'group' && <GroupRevisionModal data={data} onClose={() => setModal(null)} onSaved={() => saved('Group revision created')} />}

  </div>;
}
function GroupRevisionModal({ data, onClose, onSaved }) {
  const latest = data.revisions[0];
  const [selected, setSelected] = useState(latest?.members || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    if (busy) return; setBusy(true); setError(null);
    try { await secretStoreService.groupRevision(data.object.id, { expected_revision: data.object.revision, version_ids: selected.map(v => v.version_id) }); onSaved(); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  return <Modal open size="lg" modalHeading="Create a pinned group revision" primaryButtonText={busy ? 'Saving…' : 'Create revision'} secondaryButtonText="Cancel"
    primaryButtonDisabled={busy || selected.length === 0 || selected.length > 64}
    onRequestClose={() => !busy && onClose()} onRequestSubmit={save}>
    <div className="secret-store__form"><SecretError error={error} />
      <p>Select one encrypted version per secret. Existing revisions stay unchanged.</p>
      {Boolean(latest?.restricted_members) && <InlineNotification kind="warning" title="Some existing members are unavailable" subtitle="Unavailable members are excluded. Save a new revision using your own secrets." hideCloseButton />}
      <SecretVersionPicker selected={selected} onChange={setSelected} disabled={busy} />
    </div>
  </Modal>;
}
