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
import { Button, InlineNotification, Select, SelectItem } from '@carbon/react';
import secretStoreService from '../services/secretStoreService';
import { SecretError } from './SecretStoreForms';

export default function SecretGroupSourcePicker({ onChange, disabled }) {
  const [groups, setGroups] = useState([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [detail, setDetail] = useState(null);
  const [revisionId, setRevisionId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    secretStoreService
      .list('GROUP', offset, 50)
      .then((result) => {
        if (current) {
          setGroups(result.objects.filter((r) => !r.object.archived));
          setMore(result.has_more);
        }
      })
      .catch((e) => {
        if (current) setError(e);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [offset]);
  useEffect(() => {
    let current = true;
    setDetail(null);
    setRevisionId('');
    onChange([]);
    if (!groupId) return;
    setLoading(true);
    setError(null);
    secretStoreService
      .detail(groupId)
      .then((result) => {
        if (current) {
          setDetail(result);
          const latest = result.revisions.find((r) => !r.restricted_members && r.members.length);
          if (latest) {
            setRevisionId(latest.id);
            onChange(latest.members.map((m) => ({ ...m, group_revision_id: latest.id })));
          }
        }
      })
      .catch((e) => {
        if (current) setError(e);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [groupId, onChange]);
  const revision = detail?.revisions.find((r) => r.id === revisionId);
  return (
    <div className="secret-store__form">
      <SecretError error={error} />
      <Select
        id="source-group"
        labelText="Group"
        value={groupId}
        disabled={disabled || loading}
        onChange={(e) => setGroupId(e.target.value)}
      >
        <SelectItem value="" text="Choose a group" />
        {groups.map(({ object }) => (
          <SelectItem key={object.id} value={object.id} text={object.alias} />
        ))}
      </Select>
      <div className="secret-store__pagination">
        <span>Available groups</span>
        <div>
          <Button
            size="sm"
            kind="ghost"
            disabled={disabled || loading || !offset}
            onClick={() => {
              setGroupId('');
              setOffset((n) => Math.max(0, n - 50));
            }}
          >
            Previous
          </Button>
          <Button
            size="sm"
            kind="ghost"
            disabled={disabled || loading || !more}
            onClick={() => {
              setGroupId('');
              setOffset((n) => n + 50);
            }}
          >
            Next
          </Button>
        </div>
      </div>
      {detail && (
        <Select
          id="source-group-revision"
          labelText="Pinned group revision"
          value={revisionId}
          disabled={disabled || loading}
          onChange={(e) => {
            const r = detail.revisions.find((item) => item.id === e.target.value);
            setRevisionId(e.target.value);
            onChange(
              r && !r.restricted_members
                ? r.members.map((m) => ({ ...m, group_revision_id: r.id }))
                : []
            );
          }}
        >
          <SelectItem value="" text="Choose a revision" />
          {detail.revisions.map((r) => (
            <SelectItem
              key={r.id}
              value={r.id}
              text={`Revision ${r.revision} · ${r.members.length + r.restricted_members} secrets`}
            />
          ))}
        </Select>
      )}
      {revision?.restricted_members > 0 && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title="Group contains unavailable members"
          subtitle="Create a new group revision containing only your own available secrets before adding it."
        />
      )}
      {revision && !revision.restricted_members && (
        <p>
          {revision.members.length} fixed versions will be added. Existing references to the same
          secrets will use this revision.
        </p>
      )}
    </div>
  );
}
