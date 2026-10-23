import { glob } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

// The French fixture catalogue helpers live once, in `@odudu/testkit/i18n`; a
// package that copies them drifts from the others the first time one changes.
describe('the French fixture helpers are shared', () => {
  it('no package keeps a copy of its own', async () => {
    const copies: string[] = [];
    for await (const file of glob('packages/*/tests/**/*fr-catalogue*', {
      cwd: REPO_ROOT,
      exclude: (entry) => path.basename(entry) === 'node_modules',
    })) {
      copies.push(file);
    }
    for await (const file of glob('packages/*/src/**/*fr-catalogue*', {
      cwd: REPO_ROOT,
      exclude: (entry) => path.basename(entry) === 'node_modules',
    })) {
      copies.push(file);
    }
    expect(copies).toEqual([]);
  });
});
