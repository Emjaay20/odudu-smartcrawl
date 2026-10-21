import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MARK_PNG_BASE64 } from '#/service/mark.generated';
import { MAIL_PALETTE } from '#/service/palette.generated';
import { contrastRatio } from '#/service/palette';
import { encodePng, rasteriseMark, MARK_SIZE } from '#/service/mark-png';

const MARK_SVG = path.resolve(import.meta.dirname, '../../../instrument/src/mark.svg');

function pixels(png: Buffer): { width: number; height: number; rgba: Buffer } {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let at = 8;
  const data: Buffer[] = [];
  let width = 0;
  let height = 0;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.subarray(at + 4, at + 8).toString('latin1');
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect([body[8], body[9]]).toEqual([8, 6]);
    }
    if (type === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    expect(raw[start]).toBe(0);
    rows.push(raw.subarray(start + 1, start + 1 + width * 4));
  }
  return { width, height, rgba: Buffer.concat(rows) };
}

describe('the mark as a PNG', () => {
  it('is what the generator draws from mark.svg and the rail tokens', async () => {
    const svg = await readFile(MARK_SVG, 'utf8');
    const drawn = rasteriseMark(svg, {
      background: MAIL_PALETTE.light.rail,
      ink: MAIL_PALETTE.light.railInk,
      edge: MAIL_PALETTE.light.railEdge,
    });
    const committed = pixels(Buffer.from(MARK_PNG_BASE64, 'base64'));
    expect([committed.width, committed.height]).toEqual([MARK_SIZE, MARK_SIZE]);
    expect(committed.rgba.equals(drawn)).toBe(true);
  });

  it('is a rounded tile with transparent corners and the ink in the middle', () => {
    const png = pixels(Buffer.from(MARK_PNG_BASE64, 'base64'));
    const at = (x: number, y: number): number[] => [
      ...png.rgba.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];
    expect(at(0, 0)[3]).toBe(0);
    expect(at(6, 40)[3]).toBe(255);
    const stem = at(MARK_SIZE / 2, 50);
    expect(stem.slice(0, 3)).toEqual([0xe4, 0xe9, 0xe7]);
  });

  it('rings the tile in a mid tone that shows on the light and the dark page', () => {
    const png = pixels(Buffer.from(MARK_PNG_BASE64, 'base64'));
    const at = (x: number, y: number): number[] => [
      ...png.rgba.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];
    const [r = 0, g = 0, b = 0, a = 0] = at(0, 40);
    expect(a).toBe(255);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    expect(hex).toBe(MAIL_PALETTE.light.railEdge);
    for (const scheme of ['light', 'dark'] as const) {
      expect(contrastRatio(hex, MAIL_PALETTE[scheme].page)).toBeGreaterThan(2);
    }
    expect(at(3, 40).slice(0, 3)).toEqual([0x11, 0x15, 0x14]);
  });

  it('is small enough to ride in every message', () => {
    expect(Buffer.from(MARK_PNG_BASE64, 'base64').length).toBeLessThan(2048);
  });
});

describe('rasteriseMark', () => {
  const options = { background: '#000000', ink: '#ffffff', edge: '#888888' };

  it('refuses a shape it cannot draw rather than drawing part of a mark', () => {
    expect(() =>
      rasteriseMark('<svg viewBox="0 0 32 32" stroke-width="2"><rect/></svg>', options),
    ).toThrow(/circle/u);
    expect(() =>
      rasteriseMark(
        '<svg viewBox="0 0 32 32" stroke-width="2"><circle cx="1" cy="1" r="1"/><path d="M1 1c2 2 3 3 4 4"/></svg>',
        options,
      ),
    ).toThrow(/path/u);
  });
});

describe('rasteriseMark geometry', () => {
  const staff = [
    '<svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">',
    '<circle cx="16" cy="6" r="4"/><path d="M16 10V30"/><path d="M12 14H20"/></g></svg>',
  ].join('');
  const colours = { background: '#000000', ink: '#ffffff', edge: '#000000' };
  // The mark is drawn at 70% of the tile, centred: 1.75 pixels per grid unit
  // from an origin of 12.
  const at = (x: number, y: number): number => {
    const px = Math.round(12 + x * 1.75);
    const py = Math.round(12 + y * 1.75);
    return rasteriseMark(staff, colours)[(py * MARK_SIZE + px) * 4] ?? -1;
  };

  it('draws the collar across the shaft, to both ends, and nothing beside it', () => {
    expect(at(12.5, 14)).toBe(255);
    expect(at(19.5, 14)).toBe(255);
    expect(at(10, 14)).toBe(0);
    expect(at(22, 14)).toBe(0);
    expect(at(14, 18)).toBe(0);
    expect(at(18, 18)).toBe(0);
  });

  it('draws the ring, its open hole and the shaft below the collar', () => {
    expect(at(16, 2)).toBe(255);
    expect(at(16, 6)).toBe(0);
    expect(at(12, 6)).toBe(255);
    expect(at(16, 24)).toBe(255);
    expect(at(16, 30.5)).toBe(255);
  });
});

describe('rasteriseMark strokes', () => {
  const colours = { background: '#000000', ink: '#ffffff', edge: '#000000' };
  const drawn = (linecap: string): Buffer =>
    rasteriseMark(
      `<svg viewBox="0 0 32 32"><g stroke-width="2"${linecap}><circle cx="16" cy="6" r="4"/><path d="M16 10V30"/></g></svg>`,
      colours,
    );

  // Pixels, not grid units: the shaft's end is at row 64.5, its centre line at column 40.
  const pixel = (png: Buffer, column: number, row: number): number =>
    png[(row * MARK_SIZE + column) * 4] ?? -1;

  it('ends a butt stroke at its end and carries a round or square one past it', () => {
    expect(pixel(drawn(''), 40, 65)).toBe(0);
    expect(pixel(drawn(' stroke-linecap="butt"'), 40, 65)).toBe(0);
    expect(pixel(drawn(' stroke-linecap="round"'), 40, 65)).toBeGreaterThan(100);
    expect(pixel(drawn(' stroke-linecap="square"'), 40, 65)).toBeGreaterThan(100);
  });

  it('keeps the corner of a square cap and rounds it off for a round one', () => {
    const square = pixel(drawn(' stroke-linecap="square"'), 41, 65);
    const round = pixel(drawn(' stroke-linecap="round"'), 41, 65);
    expect(square).toBeGreaterThan(round + 20);
  });

  it('anti-aliases the edge of a stroke into a value between ink and background', () => {
    const png = drawn(' stroke-linecap="round"');
    const edge = (): number[] =>
      Array.from({ length: 40 }, (_, step) => {
        const px = 20 + step;
        return png[(60 * MARK_SIZE + px) * 4] ?? -1;
      });
    const partial = edge().filter((value) => value > 0 && value < 255);
    expect(partial.length).toBeGreaterThanOrEqual(2);
    expect(partial.every((value) => value > 100 && value < 230)).toBe(true);
  });

  it('refuses a cap it does not know and a stroke with no length', () => {
    expect(() => drawn(' stroke-linecap="bevel"')).toThrow(/linecap/u);
    expect(() =>
      rasteriseMark(
        '<svg viewBox="0 0 32 32" stroke-width="2"><circle cx="1" cy="1" r="1"/><path d="M5 5V5"/></svg>',
        colours,
      ),
    ).toThrow(/length/u);
  });
});

describe('encodePng', () => {
  it('writes a PNG whose pixels read back as given', () => {
    const rgba = Buffer.from([1, 2, 3, 255, 4, 5, 6, 128]);
    const read = pixels(encodePng(rgba, 2, 1));
    expect(read.rgba.equals(rgba)).toBe(true);
  });
});
