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
import { Button, Checkbox, DataTableSkeleton, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableContainer, TableToolbar, TableToolbarSearch } from '@carbon/react';
import secretStoreService from '../services/secretStoreService';
import { SecretError } from './SecretStoreForms';

export default function SecretVersionPicker({ selected, onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState({ rows: [], more: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    const timer = setTimeout(async () => {
      try {
        const entries = await secretStoreService.list('SECRET', offset, 20, query);
        const details = await Promise.all(entries.objects.filter(row => !row.object.archived).map(row => secretStoreService.detail(row.object.id)));
        if (current) setPage({ rows: details.map(row => ({ object: row.object, versions: row.versions.filter(v => v.state === 'SEALED') })).filter(row => row.versions.length), more: entries.has_more });
      } catch (e) { if (current) setError(e); }
      finally { if (current) setLoading(false); }
    }, 180);
    return () => { current = false; clearTimeout(timer); };
  }, [query, offset]);
  const choose = (object, version, checked) => {
    const remaining = selected.filter(v => v.secret_id !== object.id);
    onChange(checked ? [...remaining, { version_id: version.id, secret_id: object.id, alias: object.alias, version: version.version }] : remaining);
  };
  return <div className="secret-store__picker">
    <SecretError error={error} />
    <TableToolbar><TableToolbarSearch persistent placeholder="Search your secrets" value={query} onChange={e => { setQuery(typeof e === 'string' ? e : e.target.value); setOffset(0); }} /></TableToolbar>
    {loading ? <DataTableSkeleton columnCount={3} rowCount={4} showHeader={false} showToolbar={false} /> :
      <TableContainer><Table size="md" aria-label="Choose pinned secret versions"><TableHead><TableRow>
        <TableHeader>Select</TableHeader><TableHeader>Secret</TableHeader><TableHeader>Version</TableHeader>
      </TableRow></TableHead><TableBody>
        {page.rows.map(({ object, versions }) => {
          const existing = selected.find(v => v.secret_id === object.id);
          return <PickerRow key={object.id} object={object} versions={versions} selected={existing} disabled={disabled} onChange={choose} />;
        })}
        {!page.rows.length && <TableRow><TableCell colSpan={3}>No encrypted versions on this page. Add a version in the Secret Store or try another search.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>}
    <div className="secret-store__pagination">
      <span>{selected.length} selected · versions stay pinned</span>
      <div><Button kind="ghost" size="sm" disabled={loading || disabled || !offset} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</Button>
      <Button kind="ghost" size="sm" disabled={loading || disabled || !page.more} onClick={() => setOffset(offset + 20)}>Next</Button></div>
    </div>
  </div>;
}
function PickerRow({ object, versions, selected, disabled, onChange }) {
  const [versionId, setVersionId] = useState(selected?.version_id || versions[0].id);
  useEffect(() => { if (selected?.version_id) setVersionId(selected.version_id); }, [selected?.version_id]);
  const current = versions.find(v => v.id === versionId) || versions[0];
  return <TableRow>
    <TableCell><Checkbox id={`choose-secret-${object.id}`} hideLabel labelText={`Select ${object.alias}`} checked={Boolean(selected)} disabled={disabled}
      onChange={(_, { checked }) => onChange(object, current, checked)} /></TableCell>
    <TableCell>{object.alias}</TableCell>
    <TableCell><Select id={`choose-version-${object.id}`} labelText={`Version of ${object.alias}`} hideLabel value={current.id} disabled={disabled}
      onChange={e => { const value = versions.find(v => v.id === e.target.value); setVersionId(value.id); if (selected) onChange(object, value, true); }}>
      {versions.map(v => <SelectItem key={v.id} value={v.id} text={`Version ${v.version}`} />)}
    </Select></TableCell>
  </TableRow>;
}
