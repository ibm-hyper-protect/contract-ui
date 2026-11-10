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

import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useConfigStore } from './configStore';

/** Public certificates only: no persistence, at most 20 build choices per session. */
export const useBuildCertificateStore = create(set => ({
  entries: {},
  remember: (scope, certificate) => set(state => ({
    entries: { ...Object.fromEntries(Object.entries(state.entries).filter(([key]) => key !== scope).slice(-19)), [scope]: certificate },
  })),
  forget: scope => set(state => ({ entries: Object.fromEntries(Object.entries(state.entries).filter(([key]) => key !== scope)) })),
  clear: () => set({ entries: {} }),
}));

useAuthStore.subscribe((current, previous) => {
  if (current.user?.id !== previous.user?.id || current.token !== previous.token) useBuildCertificateStore.getState().clear();
});
useConfigStore.subscribe((current, previous) => {
  if (current.serverUrl !== previous.serverUrl) useBuildCertificateStore.getState().clear();
});
