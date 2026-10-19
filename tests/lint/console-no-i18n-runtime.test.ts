import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// intl-messageformat costs about 9,900 bytes gzip in a browser bundle, more
// than the console entry's headroom (console-phone-chunk.test.ts), so the
// catalogue runtime is server-side only until the console's own budget
// admits it.

const CONSOLE = path.resolve(import.meta.dirname, '../../apps/admin-console');
const FORBIDDEN = /@odudu\/i18n|intl-messageformat/u;

describe('the console and the catalogue runtime', () => {
  it('declares neither @odudu/i18n nor intl-messageformat', () => {
    const manifest = readFileSync(path.join(CONSOLE, 'package.json'), 'utf8');
    expect(manifest).not.toMatch(FORBIDDEN);
  });

  it('imports neither from any source file', () => {
    const offending = globSync('src/**/*.{ts,tsx}', { cwd: CONSOLE }).filter((file) =>
      FORBIDDEN.test(readFileSync(path.join(CONSOLE, file), 'utf8')),
    );
    expect(offending).toEqual([]);
  });
});
