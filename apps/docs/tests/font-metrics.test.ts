import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

// The fallback faces in custom.css take their vertical metrics from the Plex
// files: ascent and descent as a share of the em, divided by the face's
// size-adjust, with no line gap. This reads the numbers out of the WOFF files
// the site serves (hhea and head tables) and holds the CSS to them. The
// size-adjust values are held to the fonts by font-metrics.browser.test.ts.

const css = readFileSync(path.join(DOCS_ROOT, 'src/css/custom.css'), 'utf8');

function table(file: Buffer, tag: string): Buffer {
  const count = file.readUInt16BE(12);
  for (let index = 0; index < count; index += 1) {
    const at = 44 + index * 20;
    if (file.toString('latin1', at, at + 4) !== tag) continue;
    const offset = file.readUInt32BE(at + 4);
    const compressed = file.readUInt32BE(at + 8);
    const original = file.readUInt32BE(at + 12);
    const bytes = file.subarray(offset, offset + compressed);
    return compressed < original ? inflateSync(bytes) : bytes;
  }
  throw new Error(`no ${tag} table`);
}

function metrics(font: string): { ascent: number; descent: number; gap: number } {
  const file = readFileSync(
    path.join(
      DOCS_ROOT,
      `node_modules/@fontsource/${font.split('/')[0] ?? ''}/files/${font.split('/')[1] ?? ''}.woff`,
    ),
  );
  const em = table(file, 'head').readUInt16BE(18);
  const hhea = table(file, 'hhea');
  return {
    ascent: hhea.readInt16BE(4) / em,
    descent: -hhea.readInt16BE(6) / em,
    gap: hhea.readInt16BE(8) / em,
  };
}

function faceOf(family: string, weight?: number): Record<string, number> {
  const faces = css.match(/@font-face\s*\{[^}]*\}/gu) ?? [];
  const face = faces.find(
    (text) =>
      text.includes(`'${family}'`) &&
      (weight === undefined || text.includes(`font-weight: ${String(weight)};`)),
  );
  if (face === undefined) throw new Error(`no fallback face for ${family} ${String(weight)}`);
  const read = (name: string): number =>
    Number.parseFloat(new RegExp(`${name}:\\s*([\\d.]+)%`, 'u').exec(face)?.[1] ?? 'NaN') / 100;
  return {
    size: face.includes('size-adjust') ? read('size-adjust') : 1,
    ascent: read('ascent-override'),
    descent: read('descent-override'),
    gap: read('line-gap-override'),
  };
}

describe('the fallback faces', () => {
  for (const [family, weight, file] of [
    ['IBM Plex Sans Fallback', 400, 'ibm-plex-sans/ibm-plex-sans-latin-400-normal'],
    ['IBM Plex Sans Fallback', 600, 'ibm-plex-sans/ibm-plex-sans-latin-600-normal'],
    ['IBM Plex Mono Fallback', undefined, 'ibm-plex-mono/ibm-plex-mono-latin-400-normal'],
  ] as const) {
    it(`give ${family} ${String(weight ?? '')} the vertical space of the font it stands in for`, () => {
      const face = faceOf(family, weight);
      const font = metrics(file);
      expect(face.ascent ?? 0).toBeCloseTo(font.ascent / (face.size ?? 1), 2);
      expect(face.descent ?? 0).toBeCloseTo(font.descent / (face.size ?? 1), 2);
      expect(face.gap).toBe(font.gap);
    });
  }
});
