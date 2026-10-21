import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const BRAND = path.join(REPO_ROOT, 'brand');
const TOKENS = path.join(REPO_ROOT, 'apps/admin-console/src/shared/view/tokens.css');

function read(file: string): string {
  return readFileSync(path.join(BRAND, file), 'utf8');
}

function svgFiles(): string[] {
  return globSync('*.svg', { cwd: BRAND }).sort();
}

function tokenColours(): Set<string> {
  const css = readFileSync(TOKENS, 'utf8');
  return new Set([...css.matchAll(/#[0-9a-f]{6}\b/gu)].map((match) => match[0]));
}

// `--name: light-dark(#light, #dark)` or `--name: #value`.
function tokenPair(name: string): { light: string; dark: string } {
  const css = readFileSync(TOKENS, 'utf8');
  const line = new RegExp(`--${name}:\\s*([^;]+);`, 'u').exec(css)?.[1] ?? '';
  const colours = [...line.matchAll(/#[0-9a-f]{6}\b/gu)].map((match) => match[0]);
  const light = colours[0];
  const dark = colours[1] ?? light;
  if (light === undefined || dark === undefined) throw new Error(`no colour for --${name}`);
  return { light, dark };
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

function pngSize(file: string): { width: number; height: number; bytes: number } {
  const buffer = readFileSync(path.join(BRAND, file));
  const signature = buffer.subarray(0, 8).toString('hex');
  expect(signature, `${file} is a PNG`).toBe('89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
}

interface Mark {
  ring: { cx: number; cy: number; r: number };
  shaft: { x: number; from: number; to: number };
  crossbar: { y: number; from: number; to: number };
  strokeWidth: number;
}

function parseMark(svg: string): Mark {
  const circle = /<circle cx="(\d+)" cy="(\d+)" r="(\d+)"\/>/u.exec(svg);
  const shaft = /<path d="M(\d+) (\d+)V(\d+)"\/>/u.exec(svg);
  const crossbar = /<path d="M(\d+) (\d+)H(\d+)"\/>/u.exec(svg);
  const width = /stroke-width="(\d+)"/u.exec(svg);
  if (!circle || !shaft || !crossbar || !width) throw new Error('mark.svg is not ring, shaft, bar');
  const n = (value: string | undefined): number => Number(value);
  return {
    ring: { cx: n(circle[1]), cy: n(circle[2]), r: n(circle[3]) },
    shaft: { x: n(shaft[1]), from: n(shaft[2]), to: n(shaft[3]) },
    crossbar: { y: n(crossbar[2]), from: n(crossbar[1]), to: n(crossbar[3]) },
    strokeWidth: n(width[1]),
  };
}

function segmentDistance(
  px: number,
  py: number,
  [x1, y1, x2, y2]: [number, number, number, number],
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Area coverage of one output pixel, by sampling the mark's own geometry.
function coverage(mark: Mark, size: number, pixelX: number, pixelY: number): number {
  const scale = 32 / size;
  const samples = 8;
  let inside = 0;
  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      const x = (pixelX + (sx + 0.5) / samples) * scale;
      const y = (pixelY + (sy + 0.5) / samples) * scale;
      const half = mark.strokeWidth / 2;
      const onRing = Math.abs(Math.hypot(x - mark.ring.cx, y - mark.ring.cy) - mark.ring.r) <= half;
      const onShaft =
        segmentDistance(x, y, [mark.shaft.x, mark.shaft.from, mark.shaft.x, mark.shaft.to]) <= half;
      const onBar =
        segmentDistance(x, y, [
          mark.crossbar.from,
          mark.crossbar.y,
          mark.crossbar.to,
          mark.crossbar.y,
        ]) <= half;
      if (onRing || onShaft || onBar) inside += 1;
    }
  }
  return inside / (samples * samples);
}

describe('brand assets: every SVG', () => {
  it('ships the files the brand directory lists', () => {
    for (const file of [
      'mark.svg',
      'wordmark.svg',
      'lockup.svg',
      'favicon.svg',
      'favicon.ico',
      'social.svg',
      'social.png',
      'apple-touch-icon.png',
      'README.md',
    ]) {
      expect(existsSync(path.join(BRAND, file)), file).toBe(true);
    }
  });

  it('has a viewBox, a title and a description, and nothing that executes or fetches', () => {
    const files = svgFiles();
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) {
      const svg = read(file);
      expect(svg, `${file} viewBox`).toMatch(/<svg [^>]*viewBox="[\d. -]+"/u);
      expect(svg, `${file} title`).toMatch(/<title>[^<]+<\/title>/u);
      expect(svg, `${file} desc`).toMatch(/<desc>[^<]+<\/desc>/u);
      expect(svg, `${file} script`).not.toMatch(/<script/iu);
      expect(svg, `${file} style attribute`).not.toMatch(/\sstyle=/iu);
      expect(svg, `${file} style element`).not.toMatch(/<style/iu);
      expect(svg, `${file} image`).not.toMatch(/<image/iu);
      expect(svg, `${file} link`).not.toMatch(/href=|url\(|@import|@font-face|font-family/iu);
      expect(svg, `${file} text`).not.toMatch(/<text/iu);
    }
  });

  it('takes colours only from the Instrument tokens, or from the surrounding text colour', () => {
    const allowed = tokenColours();
    for (const file of svgFiles()) {
      const svg = read(file);
      const values = [...svg.matchAll(/\b(?:fill|stroke|stop-color)="([^"]+)"/gu)].map(
        (match) => match[1] ?? '',
      );
      for (const value of values) {
        const ok = value === 'currentColor' || value === 'none' || allowed.has(value);
        expect(ok, `${file}: ${value} is not an Instrument token`).toBe(true);
      }
    }
  });

  it('keeps the mark, wordmark and lockup to one colour so they theme', () => {
    for (const file of ['mark.svg', 'wordmark.svg', 'lockup.svg']) {
      expect(read(file), file).not.toMatch(/#[0-9a-f]{6}/iu);
    }
  });
});

describe('brand assets: the staff mark', () => {
  const mark = parseMark(read('mark.svg'));

  it('sets one stroke width, once, on a group, with round caps and no fill', () => {
    const svg = read('mark.svg');
    expect(svg.match(/stroke-width=/gu)).toHaveLength(1);
    expect(svg).toMatch(/<g [^>]*stroke-width="2"/u);
    expect(svg).toMatch(/<g [^>]*stroke-linecap="round"/u);
    expect(svg).toMatch(/<g [^>]*fill="none"/u);
    expect(mark.strokeWidth).toBe(2);
  });

  it('is symmetric about the vertical centre line of a 32 grid', () => {
    expect(read('mark.svg')).toContain('viewBox="0 0 32 32"');
    expect(mark.shaft.x).toBe(16);
    expect(mark.ring.cx).toBe(16);
    expect((mark.crossbar.from + mark.crossbar.to) / 2).toBe(16);
  });

  it('sits on whole grid units, with the ring clear of the crossbar', () => {
    const numbers = [
      ...Object.values(mark.ring),
      ...Object.values(mark.shaft),
      ...Object.values(mark.crossbar),
    ];
    expect(numbers.every(Number.isInteger)).toBe(true);
    expect(mark.crossbar.y - (mark.ring.cy + mark.ring.r)).toBeGreaterThanOrEqual(
      3 * mark.strokeWidth,
    );
    expect(mark.crossbar.to - mark.crossbar.from).toBeGreaterThanOrEqual(4 * mark.strokeWidth);
  });

  it('starts the shaft on the ring, so its cap does not poke into the hole', () => {
    expect(mark.shaft.from).toBeGreaterThanOrEqual(mark.ring.cy + mark.ring.r);
  });

  it('stays inside the grid with the stroke, so nothing clips', () => {
    const half = mark.strokeWidth / 2;
    expect(mark.ring.cy - mark.ring.r - half).toBeGreaterThanOrEqual(0);
    expect(mark.shaft.to + half).toBeLessThanOrEqual(32);
    expect(mark.crossbar.from - half).toBeGreaterThanOrEqual(0);
    expect(mark.crossbar.to + half).toBeLessThanOrEqual(32);
  });

  it('has a ring whose hole stays open and a shaft that stays continuous at 16 px', () => {
    const size = 16;
    const holeX = Math.floor(mark.ring.cx / 2);
    const holeY = Math.floor(mark.ring.cy / 2);
    expect(coverage(mark, size, holeX, holeY)).toBe(0);
    for (let y = 6; y < 14; y += 1) {
      const row = coverage(mark, size, 7, y) + coverage(mark, size, 8, y);
      expect(row, `shaft row ${String(y)}`).toBeGreaterThanOrEqual(0.95);
    }
    const bar = Math.floor(mark.crossbar.y / 2);
    const barCover = [6, 7, 8, 9].map(
      (x) => coverage(mark, size, x, bar - 1) + coverage(mark, size, x, bar),
    );
    expect(Math.max(...barCover)).toBeGreaterThanOrEqual(0.9);
  });

  it('holds its ring open at the smallest size it is shipped', () => {
    const innerRadius = mark.ring.r - mark.strokeWidth / 2;
    expect((innerRadius * 16) / 32).toBeGreaterThanOrEqual(1.5);
  });
});

describe('brand assets: contrast on Instrument surfaces', () => {
  it('reads at 4.5:1 or better in light and dark', () => {
    const pairs: [string, string][] = [
      ['ink-primary', 'surface-page'],
      ['ink-primary', 'surface-panel'],
      ['ink-rail', 'surface-rail'],
    ];
    for (const [ink, surface] of pairs) {
      const a = tokenPair(ink);
      const b = tokenPair(surface);
      expect(contrast(a.light, b.light), `${ink} on ${surface}, light`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.dark, b.dark), `${ink} on ${surface}, dark`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('draws the favicon and social image in the pairs checked above', () => {
    const rail = tokenPair('surface-rail').light;
    const ink = tokenPair('ink-rail').light;
    for (const file of ['favicon.svg', 'social.svg']) {
      const svg = read(file);
      expect(svg, file).toContain(rail);
      expect(svg, file).toContain(ink);
    }
  });
});

describe('brand assets: wordmark', () => {
  it('is the lowercase word odudu, drawn as five outlines', () => {
    const svg = read('wordmark.svg');
    expect(svg).toContain('<title>odudu</title>');
    const paths = [...svg.matchAll(/<path d="(M[^"]+)"\/>/gu)];
    expect(paths).toHaveLength(5);
    for (const found of paths) expect(found[1]?.length ?? 0).toBeGreaterThan(80);
  });

  it('puts the mark and the wordmark on one baseline in the lockup', () => {
    const lockup = read('lockup.svg');
    expect(lockup).toContain('viewBox="0 0 ');
    expect(lockup.match(/<path d="M[^"]+Z"\/>/gu)).toHaveLength(5);
    expect(lockup).toContain('stroke-width="2"');
  });

  it('records the font licence beside the outlines', () => {
    const readme = read('README.md');
    expect(readme).toContain('IBM Plex Mono');
    expect(readme).toContain('SIL Open Font License');
    expect(existsSync(path.join(BRAND, 'LICENSE-IBM-Plex-Mono.txt'))).toBe(true);
  });
});

describe('brand assets: derivatives', () => {
  it('keeps favicon.svg under 1 KB', () => {
    expect(Buffer.byteLength(read('favicon.svg'))).toBeLessThan(1024);
  });

  it('exports the social image at 1200 x 630 under 300 KB', () => {
    const { width, height, bytes } = pngSize('social.png');
    expect([width, height]).toEqual([1200, 630]);
    expect(bytes).toBeLessThan(300 * 1024);
  });

  it('exports the touch icon at 180 x 180', () => {
    const { width, height } = pngSize('apple-touch-icon.png');
    expect([width, height]).toEqual([180, 180]);
  });

  it('packs 16, 32 and 48 px images into favicon.ico', () => {
    const buffer = readFileSync(path.join(BRAND, 'favicon.ico'));
    expect(buffer.readUInt16LE(0)).toBe(0);
    expect(buffer.readUInt16LE(2)).toBe(1);
    const count = buffer.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => buffer.readUInt8(6 + index * 16));
    expect(sizes).toEqual([16, 32, 48]);
  });
});

describe('brand assets: the README', () => {
  it('says the name and mark are not licensed', () => {
    expect(read('README.md')).toContain('The name Odudu and the staff mark are not licensed');
  });

  it('marks the mark as proposed until the owner approves it', () => {
    expect(read('README.md')).toMatch(/proposed, awaiting owner approval/u);
  });
});
