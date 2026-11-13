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

import React, { useRef } from 'react';
import { Button, PasswordInput, Stack, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import '../styles/compose-import.scss';

/** Persona-specific seeds stay in their section and are never generated or trimmed. */
export default function VolumeFields({ volumes, onChange, environment = false, disabled = false }) {
  const nextId = useRef(Math.max(-1, ...volumes.map(item => item.id)) + 1);
  const prefix = environment ? 'environment-volume' : 'workload-volume';
  const update = (id, field, value) => onChange(volumes.map(item => item.id === id ? { ...item, [field]: value } : item));
  return <Stack gap={5}>
    {volumes.map((volume, index) => <fieldset key={volume.id} className="compose-import__volume">
      <legend>Volume {index + 1}</legend>
      <Stack gap={5}>
        <div className={environment ? undefined : "compose-import__fields"}>
          <TextInput id={`${prefix}-${volume.id}-name`} labelText="Volume name" value={volume.name} disabled={disabled}
            onChange={event => update(volume.id, 'name', event.target.value)} helperText={`Use the same name in the ${environment ? 'workload' : 'environment'} section.`} />
          {!environment && <TextInput id={`${prefix}-${volume.id}-mount`} labelText="Guest mount path" value={volume.mount} disabled={disabled}
            onChange={event => update(volume.id, 'mount', event.target.value)} helperText="Match the absolute host path in the container definition, for example /mnt/data." />}
        </div>
        <PasswordInput id={`${prefix}-${volume.id}-seed`} labelText={`${environment ? 'Environment' : 'Workload'} volume seed`} value={volume.seed} disabled={disabled}
          onChange={event => update(volume.id, 'seed', event.target.value)} autoComplete="off" />
        <Button kind="ghost" size="sm" renderIcon={TrashCan} disabled={disabled} aria-label={`Remove volume ${index + 1}`}
          onClick={() => onChange(volumes.filter(item => item.id !== volume.id))}>Remove volume</Button>
      </Stack>
    </fieldset>)}
    <Button kind="tertiary" size="sm" renderIcon={Add} disabled={disabled} onClick={() => {
      onChange([...volumes, { id: nextId.current++, name: '', mount: '', seed: '' }]);
    }}>Add volume</Button>
    <p>Match volume names between workload and environment, using each section’s own seed. For existing data, retain both original seeds. No seeds are generated or replaced automatically.</p>
  </Stack>;
}
