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
import { ArrowRight } from '@carbon/icons-react';
import assignmentService from '../services/assignmentService';
import buildService from '../services/buildService';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { getRoleLabel } from '../utils/roles';
import { isAssignedNextRole } from '../utils/buildRoleHandoff';

/** Recheck permissions and stage before changing the local persona. */
export default function BuildRoleHandoff({ buildId, status, role, roles, onContinue }) {
  const userId = useAuthStore(state => state.user?.id);
  const token = useAuthStore(state => state.token);
  const serverUrl = useConfigStore(state => state.serverUrl);
  const view = useRef(null);
  const alive = useRef(true);
  view.current = JSON.stringify([buildId, status, role, userId, token, serverUrl, roles]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setContext(null);
    setError('');
    assignmentService.getBuildAssignments(buildId).then(assignments => {
      if (active) setContext({ buildId, status, role, userId, token, serverUrl, assignments });
    }).catch(() => {
      if (active) setError('Unable to check your build assignment.');
    });
    return () => { active = false; };
  }, [buildId, status, role, userId, token, serverUrl, retry]);

  const current = context?.buildId === buildId && context?.status === status &&
    context?.role === role && context?.userId === userId && context?.token === token && context?.serverUrl === serverUrl;
  const allowed = current && isAssignedNextRole({ assignments: context.assignments, userId, role, roles });
  async function proceed() {
    if (!allowed || busy) return;
    const initial = view.current;
    setBusy(true);
    setError('');
    try {
      const [build, assignments] = await Promise.all([
        buildService.getBuild(buildId), assignmentService.getBuildAssignments(buildId),
      ]);
      if (!alive.current || view.current !== initial || useAuthStore.getState().token !== token || useConfigStore.getState().serverUrl !== serverUrl) return;
      if (build.status !== status) throw new Error('The build stage changed. Reopen the build to see its next step.');
      if (!isAssignedNextRole({ assignments, userId, role, roles })) {
        setContext(null);
        throw new Error('You are no longer assigned to this step.');
      }
      onContinue(role);
    } catch (failure) {
      if (alive.current && view.current === initial) setError(failure.message || 'Unable to continue. Try again.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return <div>
    {allowed && <Button kind="tertiary" renderIcon={ArrowRight} disabled={busy} onClick={proceed}>
      {busy ? 'Checking assignment…' : `Continue as ${getRoleLabel(role)}`}
    </Button>}
    {error && <>
      <InlineNotification kind="error" title="Role handoff unavailable" subtitle={error} hideCloseButton lowContrast />
      <Button kind="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>Check assignment again</Button>
    </>}
  </div>;
}
