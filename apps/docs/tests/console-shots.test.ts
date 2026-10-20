import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCREENS } from '#docs/scripts/console-shots/screens.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const OUT = path.join(DOCS_ROOT, 'static/console');
const PAGES = ['quick-start/index.mdx'];
const manifest = JSON.parse(readFileSync(path.join(OUT, 'manifest.json'), 'utf8')) as Record<
  string,
  { width: number; height: number }
>;

interface Used {
  name: string;
  alt: string;
  caption: string;
}

function used(): Used[] {
  return PAGES.flatMap((page) => {
    const text = readFileSync(path.join(DOCS_ROOT, 'content/en', page), 'utf8');
    return [...text.matchAll(/<ConsoleShot\s+([\s\S]*?)\/>/gu)].map((match) => {
      const prop = (key: string): string =>
        new RegExp(`${key}="([^"]*)"`, 'u').exec(match[1] ?? '')?.[1] ?? '';
      return { name: prop('name'), alt: prop('alt'), caption: prop('caption') };
    });
  });
}

// A lossy or lossless WebP's canvas size, from its header.
function webpSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = bytes.toString('ascii', 12, 16);
  if (kind === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  const bits = bytes.readUInt32LE(21);
  return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
}

describe('the console captures', () => {
  it('has a light and a dark WebP of the size the manifest gives, for every screen', () => {
    expect(Object.keys(manifest).sort()).toEqual(SCREENS.map((screen) => screen.name).sort());
    for (const screen of SCREENS) {
      for (const theme of ['light', 'dark']) {
        const file = path.join(OUT, `${screen.name}-${theme}.webp`);
        expect(existsSync(file), file).toBe(true);
        expect(webpSize(file), file).toEqual(manifest[screen.name]);
      }
    }
  });

  it('gives every screen alt text, a caption and something to check before it is shot', () => {
    for (const screen of SCREENS) {
      expect(screen.alt.length, screen.name).toBeGreaterThan(20);
      expect(screen.caption.length, screen.name).toBeGreaterThan(10);
      expect(screen.expect.length, screen.name).toBeGreaterThan(0);
    }
  });

  it('shows on the pages only captures that exist, with the alt text and caption the screen gives', () => {
    const shown = used();
    expect(shown.length).toBeGreaterThan(5);
    for (const { name, alt, caption } of shown) {
      const screen = SCREENS.find((candidate) => candidate.name === name);
      expect(screen, name).toBeDefined();
      expect(alt, name).toBe(screen?.alt);
      expect(caption, name).toBe(screen?.caption);
    }
  });

  it('leaves no capture unused', () => {
    const names = new Set(used().map((entry) => entry.name));
    expect(SCREENS.map((screen) => screen.name).filter((name) => !names.has(name))).toEqual([]);
  });

  it('never presses the button that makes the console show a one-time password', () => {
    const source = readFileSync(path.join(DOCS_ROOT, 'scripts/console-shots/screens.ts'), 'utf8');
    expect(source).not.toMatch(/getByRole\('button', \{ name: 'Issue password'[^)]*\)\s*\.click/u);
  });
});
