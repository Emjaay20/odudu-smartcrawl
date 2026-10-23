import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT, distDir, walk, type Target } from '#docs/tests/support/dist.ts';

const REPO_ROOT = path.resolve(DOCS_ROOT, '../..');
const notices = readFileSync(path.join(REPO_ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8');

function slug(family: string): string {
  return family.replaceAll(' ', '-').replace(/^IBM-Plex/u, 'IBM-Plex');
}

// Every family a built site serves from a font file, not the fallbacks that name installed fonts.
function servedFamilies(target: Target): string[] {
  const css = walk(path.join(distDir(target), 'assets/css'))
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  const faces = (css.match(/@font-face\{[^}]*\}/gu) ?? []).filter((face) => face.includes('url('));
  return [
    ...new Set(
      faces.flatMap((face) => {
        const match = /font-family:\s*["']?([^;"'}]+)["']?/u.exec(face);
        return match?.[1] === undefined ? [] : [match[1].trim()];
      }),
    ),
  ];
}

describe('the licences of the fonts the sites serve', () => {
  for (const target of ['pages', 'image'] as const) {
    it(`gives every family of the ${target} build a notice, a copyright line and the licence text beside it`, () => {
      const families = servedFamilies(target);
      expect(families.length).toBeGreaterThan(0);
      for (const family of families) {
        expect(notices, `${family} is not named in THIRD-PARTY-NOTICES.md`).toContain(family);
        const file = path.join(distDir(target), 'licenses', `${slug(family)}-OFL-1.1.txt`);
        expect(existsSync(file), `${family}: ${file} was not published`).toBe(true);
        const text = readFileSync(file, 'utf8');
        expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
        expect(text).toMatch(/Copyright 20\d\d IBM Corp/u);
      }
    });
  }

  it('publishes exactly the text kept under LICENSES/', () => {
    for (const name of ['Sans', 'Mono']) {
      const kept = readFileSync(path.join(REPO_ROOT, `LICENSES/OFL-1.1-IBM-Plex-${name}.txt`));
      const served = readFileSync(
        path.join(DOCS_ROOT, `static/licenses/IBM-Plex-${name}-OFL-1.1.txt`),
      );
      expect(served.equals(kept), name).toBe(true);
    }
  });
});
