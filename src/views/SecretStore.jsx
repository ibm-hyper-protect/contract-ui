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
import { Button, DataTableSkeleton, Tab, TabList, TabPanels, TabPanel, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, TableToolbarSearch, Tag, Tile } from '@carbon/react';
import { Add, Renew } from '@carbon/icons-react';
import PageHeader from '../components/PageHeader';
import { SecretError, SecretMetadataModal } from '../components/SecretStoreForms';
import SecretStoreDetail from '../components/SecretStoreDetail';
import secretStoreService from '../services/secretStoreService';
import { canUseSecretStore } from '../utils/secretStore';
import '../styles/secret-store.scss';

export default function SecretStore({ userRole }) {
  const [kind, setKind] = useState('SECRET');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ objects: [], has_more: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const requestKey = JSON.stringify([kind, offset, query]);
  useEffect(() => {
    if (!canUseSecretStore(userRole)) return;
    let current = true; setLoading(true); setError(null);
    const timer = setTimeout(() => secretStoreService.list(kind, offset, 25, query)
      .then(result => { if (current) setData({ ...result, requestKey }); })
      .catch(e => { if (current) { setError(e); setData({ objects: [], has_more: false }); } })
      .finally(() => { if (current) setLoading(false); }), 150);
    return () => { current = false; clearTimeout(timer); };
  }, [kind, offset, query, refresh, userRole]);
  if (!canUseSecretStore(userRole)) return <div className="app-page"><PageHeader title="Secret store" description="This role has no access to the secret catalog." /></div>;
  if (selected) return <SecretStoreDetail key={selected} objectId={selected} onBack={() => { setSelected(null); setRefresh(n => n + 1); }} />;
  return <div className="app-page secret-store">
    <PageHeader title="Secret store" description="Your encrypted secrets and personal groups. Runtime secret types are chosen later."
      actions={<><Button kind="ghost" renderIcon={Renew} onClick={() => setRefresh(n => n + 1)} disabled={loading}>Refresh</Button>
        <Button renderIcon={Add} onClick={() => setCreating(true)}>{kind === 'GROUP' ? 'Create group' : 'Create secret'}</Button></>} />
    <Tile className="secret-store__intro"><strong>Store a value once. Choose its use when preparing a build.</strong>
      <p>Only you can access these entries. Use groups to add several pinned secret versions to a build at once.</p></Tile>
    <Tabs selectedIndex={kind === 'SECRET' ? 0 : 1} onChange={({ selectedIndex }) => { setKind(selectedIndex ? 'GROUP' : 'SECRET'); setOffset(0); }}>
      <TabList aria-label="Secret catalog"><Tab>Secrets</Tab><Tab>Groups</Tab></TabList>
      <TabPanels>{['SECRET', 'GROUP'].map(tabKind => <TabPanel key={tabKind}>
        {kind === tabKind && <>
          <SecretError error={error} />
          <TableContainer className="secret-store__catalog" aria-busy={loading}>
            <TableToolbar><TableToolbarContent>
              <TableToolbarSearch persistent value={query} placeholder={kind === 'GROUP' ? 'Search groups' : 'Search secrets'}
                onChange={e => { setQuery(typeof e === 'string' ? e : e.target.value); setOffset(0); }} />

            </TableToolbarContent></TableToolbar>
            <div className="secret-store__table-body">
            {loading && data.requestKey !== requestKey ? <DataTableSkeleton size="lg" rowCount={5} columnCount={4} showHeader={false} showToolbar={false} /> :
              <Table aria-label={kind === 'GROUP' ? 'Secret groups' : 'Secret entries'} size="lg"><TableHead><TableRow>
                <TableHeader>Alias</TableHeader><TableHeader>Description</TableHeader><TableHeader>Updated</TableHeader><TableHeader>Status</TableHeader>
              </TableRow></TableHead><TableBody>
                {data.objects.map(({ object }) => <TableRow key={object.id}>
                  <TableCell><Button kind="ghost" size="sm" className="secret-store__entry-link" onClick={() => setSelected(object.id)}>{object.alias}</Button></TableCell>
                  <TableCell><span className="secret-store__cell-text" title={object.description}>{object.description || '—'}</span></TableCell><TableCell><span className="secret-store__cell-text">{new Date(object.updated_at).toLocaleDateString()}</span></TableCell>
                  <TableCell><Tag type={object.archived ? 'gray' : 'blue'}>{object.archived ? 'Archived' : 'Active'}</Tag></TableCell>
                </TableRow>)}
                {data.objects.length > 0 && Array.from({ length: Math.max(0, 5 - data.objects.length) }, (_, index) => <TableRow key={`space-${index}`} className="secret-store__spacer-row" aria-hidden="true"><TableCell colSpan={4} /></TableRow>)}
                {!data.objects.length && <TableRow className="secret-store__empty-row"><TableCell colSpan={4}>
                  <div className="secret-store__empty"><strong>{query ? 'No matching entries' : kind === 'GROUP' ? 'No groups yet' : 'No secrets yet'}</strong>
                    <p>{query ? 'Try another search.' : 'Create your first personal entry to get started.'}</p></div>
                </TableCell></TableRow>}
              </TableBody></Table>}
            </div>
          </TableContainer>
          <div className="secret-store__pagination"><span>{data.objects.length ? `Entries ${offset + 1}–${offset + data.objects.length}` : 'No entries'}</span>
            <div><Button kind="ghost" size="sm" disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button>
              <Button kind="ghost" size="sm" disabled={!data.has_more || loading} onClick={() => setOffset(offset + 25)}>Next</Button></div>
          </div>
        </>}
      </TabPanel>)}</TabPanels>
    </Tabs>
    {creating && <SecretMetadataModal kind={kind} onClose={() => setCreating(false)} onSaved={object => { setCreating(false); setSelected(object.id); }} />}
  </div>;
}
