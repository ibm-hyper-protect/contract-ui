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

import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Vite accepts extensionless ESM imports in src; allow the same imports in Node tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('.') &&
      context.parentURL?.startsWith(new URL('../src/', import.meta.url).href)
    ) {
      const url = new URL(specifier, context.parentURL);
      if (
        !url.pathname.endsWith('.js') &&
        existsSync(fileURLToPath(url) + '.js')
      ) {
        return nextResolve(url.href + '.js', context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (
      url.startsWith(new URL('../src/', import.meta.url).href) &&
      url.endsWith('.js')
    ) {
      return {
        format: 'module',
        source: readFileSync(new URL(url), 'utf8'),
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});
