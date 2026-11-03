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
