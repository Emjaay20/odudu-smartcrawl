import { glob } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHIPPED_LOCALES } from '../../packages/i18n/src/index.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

async function cataloguesInSource(): Promise<string[]> {
  const found: string[] = [];
  for await (const file of glob('packages/*/src/**/*.ts', {
    cwd: REPO_ROOT,
    exclude: (entry) => path.basename(entry) === 'node_modules',
  })) {
    if (file.startsWith('packages/i18n/') || file.endsWith('.test.ts')) continue;
    if ((await readFile(path.join(REPO_ROOT, file), 'utf8')).includes('createCatalogue(')) {
      found.push(file);
    }
  }
  return found.sort();
}

function localesOf(value: unknown): readonly string[] | null {
  if (typeof value !== 'object' || value === null || !('locales' in value)) return null;
  const { locales } = value;
  return Array.isArray(locales) && locales.every((tag) => typeof tag === 'string') ? locales : null;
}

// The discovery list and the negotiation read SHIPPED_LOCALES, so a catalogue
// that holds a locale the list lacks would never be chosen or advertised, and
// a listed locale with no catalogue would be advertised and never shown. A
// package that builds a catalogue only has to export it from the module that
// calls `createCatalogue`; this test finds it there.
describe('SHIPPED_LOCALES agrees with the catalogues', () => {
  it('lists en, the source every catalogue falls back to', () => {
    expect(SHIPPED_LOCALES).toContain('en');
  });

  it('holds every locale a catalogue holds, and no catalogue holds one it does not list', async () => {
    const held = new Set<string>();
    for (const file of await cataloguesInSource()) {
      const module: unknown = await import(path.join(REPO_ROOT, file));
      const catalogues = Object.values(module as Record<string, unknown>).flatMap((entry) => {
        const locales = localesOf(entry);
        return locales === null ? [] : [locales];
      });
      expect(
        catalogues.length,
        `${file} calls createCatalogue but exports no catalogue`,
      ).toBeGreaterThan(0);
      for (const locales of catalogues) {
        expect(locales, `${file} must hold en`).toContain('en');
        for (const tag of locales) {
          expect(SHIPPED_LOCALES, `${file} holds ${tag}, which SHIPPED_LOCALES lacks`).toContain(
            tag,
          );
          held.add(tag);
        }
      }
    }
    // Once any catalogue exists, a listed locale must be held by one.
    if (held.size > 0) {
      for (const tag of SHIPPED_LOCALES) {
        expect(held.has(tag), `${tag} is shipped but no catalogue holds it`).toBe(true);
      }
    }
  });
});
