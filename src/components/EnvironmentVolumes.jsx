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

import React, { useState } from 'react';
import { InlineNotification, Modal, Stack } from '@carbon/react';
import VolumeFields from './VolumeFields';
import { prepareEnvironmentVolumes, readEnvironmentVolumes } from '../utils/environmentVolumes';

/** Review environment volume changes in the existing YAML editor before submission. */
export default function EnvironmentVolumes({ content, onClose, onApply }) {
  const [initial] = useState(() => {
    try { return { volumes: readEnvironmentVolumes(content), error: '' }; }
    catch (error) { return { volumes: [], error: error.message }; }
  });
  const [volumes, setVolumes] = useState(initial.volumes);
  const [error, setError] = useState(initial.error);
  function prepare() {
    try { onApply(prepareEnvironmentVolumes(content, volumes)); }
    catch (failure) { setError(failure.message || 'Unable to prepare environment volumes.'); }
  }
  return <Modal open size="lg" modalHeading="Configure environment volumes" modalLabel="Environment preparation"
    primaryButtonText="Review environment YAML" secondaryButtonText="Cancel" onRequestSubmit={prepare}
    primaryButtonDisabled={!!initial.error || volumes.some(item => !item.name.trim() || !item.seed.trim())}
    onRequestClose={onClose} onSecondarySubmit={onClose} preventCloseOnClickOutside>
    <Stack gap={5}>
      <p>Add the matching environment declarations for workload volumes. Mount paths and filesystem settings belong in the workload. Other environment settings are preserved.</p>
      <VolumeFields volumes={volumes} onChange={setVolumes} environment disabled={!!initial.error} />
      {error && <InlineNotification kind="error" title="Environment volumes could not be prepared" subtitle={error} hideCloseButton lowContrast />}
    </Stack>
  </Modal>;
}
