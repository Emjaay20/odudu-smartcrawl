import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

// Matches `from '…'`, `import '…'`, `import('…')` and `import type … from '…'`
// whose specifier is relative or the `#/` alias and ends in .ts or .tsx.
const EXTENSIONED = /(?:from|import)\s*\(?\s*['"]((?:\.{1,2}\/|#\/)[^'"]*\.tsx?)['"]/g;

const TREES = [
  'apps/admin-console/src/**/*.{ts,tsx}',
  'apps/admin-console/tests/**/*.{ts,tsx}',
  'apps/admin-console/e2e/**/*.{ts,tsx}',
  'apps/admin-console/scripts/**/*.{ts,tsx}',
];

describe('console imports carry no file extension', { timeout: 60_000 }, () => {
  it('names no .ts or .tsx suffix in a relative or #/ specifier', async () => {
    const offences: string[] = [];
    for (const pattern of TREES) {
      for await (const file of glob(pattern, {
        cwd: REPO_ROOT,
        exclude: (entry) => path.basename(entry) === 'node_modules',
      })) {
        const text = await readFile(path.join(REPO_ROOT, file), 'utf8');
        for (const match of text.matchAll(EXTENSIONED)) {
          const line = text.slice(0, match.index).split('\n').length.toString();
          offences.push(`${file}:${line} ${match[1] ?? ''}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});
