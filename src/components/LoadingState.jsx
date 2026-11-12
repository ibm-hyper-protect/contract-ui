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

import React, { useMemo, useSyncExternalStore } from 'react';
import { useTheme } from '@carbon/react';
import connection from '../assets/loading/connection.svg?raw';
import analytics from '../assets/loading/analytics.svg?raw';
import eventStream from '../assets/loading/event-stream.svg?raw';
import contractAssembly from '../assets/loading/contract-assembly.svg?raw';
import keyMaterial from '../assets/loading/key-material.svg?raw';
import layerStack from '../assets/loading/layer-stack.svg?raw';
import archivePack from '../assets/loading/archive-pack.svg?raw';
import tableScan from '../assets/loading/table-scan.svg?raw';
import signatureTrace from '../assets/loading/signature-trace.svg?raw';
import taskRouting from '../assets/loading/task-routing.svg?raw';
import '../styles/loading-state.scss';

const GRAPHICS = {
  connection,
  analytics,
  'event-stream': eventStream,
  'contract-assembly': contractAssembly,
  'key-material': keyMaterial,
  'layer-stack': layerStack,
  'archive-pack': archivePack,
  'table-scan': tableScan,
  'signature-trace': signatureTrace,
  'task-routing': taskRouting,
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const subscribeToMotion = (onChange) => {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** Indeterminate activity; the caller controls its lifetime and status text. */
export default function LoadingState({
  variant = 'connection',
  description = 'Loading…',
  size = 'section',
}) {
  const { theme } = useTheme();
  const reduceMotion = useSyncExternalStore(subscribeToMotion, getReducedMotion, () => false);
  const graphic = Object.hasOwn(GRAPHICS, variant) ? variant : 'connection';
  const layout = ['inline', 'section', 'page'].includes(size) ? size : 'section';
  const scheme = ['g90', 'g100'].includes(theme) ? 'dark' : 'light';
  const source = useMemo(() => {
    // Only bundled SVG source and fixed preference values enter this image.
    // Explicit attributes also work when Chromium does not pass media queries
    // into SVG image documents. Keep the SVG isolated from the renderer DOM.
    const svg = GRAPHICS[graphic].replace(
      '<svg ',
      `<svg data-theme="${scheme}" data-motion="${reduceMotion ? 'reduce' : 'allow'}" `,
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [graphic, scheme, reduceMotion]);

  return (
    <div className={`app-loading app-loading--${layout}`} role="status" aria-live="polite" aria-atomic="true">
      <img
        className="app-loading__graphic"
        src={source}
        width="320"
        height="176"
        alt=""
        aria-hidden="true"
      />
      <p className="app-loading__description">{description}</p>
    </div>
  );
}
