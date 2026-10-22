import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Text only a development build may show must not be in the production
// bundle: the failure screen's message label is named inside the build-mode
// branch Vite folds away, and this reads the built chunks for it. A new
// development-only string is a new row.
const ASSETS = path.resolve(import.meta.dirname, '../../apps/admin-console/dist/assets');
const DEVELOPMENT_ONLY = ['Message, shown in a development build only'] as const;

export function holding(chunks: readonly { name: string; text: string }[]): string[] {
  return chunks.flatMap(({ name, text }) =>
    DEVELOPMENT_ONLY.filter((string) => text.includes(string)).map(
      (string) => `${name}: ${string}`,
    ),
  );
}

describe("the console's production bundle", () => {
  it('holds none of the text only a development build shows', () => {
    if (!existsSync(ASSETS)) {
      throw new Error('apps/admin-console/dist is missing: run the build first');
    }
    const chunks = readdirSync(ASSETS)
      .filter((name) => name.endsWith('.js'))
      .map((name) => ({ name, text: readFileSync(path.join(ASSETS, name), 'utf8') }));
    expect(chunks.length).toBeGreaterThan(10);
    expect(holding(chunks)).toEqual([]);
  });

  it('finds a development-only string where one is', () => {
    const chunk = { name: 'index-a.js', text: `x="${DEVELOPMENT_ONLY[0]}";` };
    expect(holding([chunk])).toEqual([`index-a.js: ${DEVELOPMENT_ONLY[0]}`]);
  });
});
