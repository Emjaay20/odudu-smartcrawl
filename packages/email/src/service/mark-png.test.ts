import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MARK_PNG_BASE64 } from '#/service/mark.generated';
import { MAIL_PALETTE } from '#/service/palette.generated';
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

  it('is small enough to ride in every message', () => {
    expect(Buffer.from(MARK_PNG_BASE64, 'base64').length).toBeLessThan(2048);
  });
});

describe('rasteriseMark', () => {
  const options = { background: '#000000', ink: '#ffffff' };

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

describe('encodePng', () => {
  it('writes a PNG whose pixels read back as given', () => {
    const rgba = Buffer.from([1, 2, 3, 255, 4, 5, 6, 128]);
    const read = pixels(encodePng(rgba, 2, 1));
    expect(read.rgba.equals(rgba)).toBe(true);
  });
});
