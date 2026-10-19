import { crc32, deflateSync } from 'node:zlib';

// Drawn at twice the 40px the mail shows it at, so a dense screen stays sharp.
export const MARK_SIZE = 80;
const SAMPLES = 8;
const TILE_RADIUS = 16;
const EDGE_WIDTH = 2;

export interface MarkColours {
  readonly background: string;
  readonly ink: string;
  // A ring just inside the tile's edge, so the tile shows on a dark page.
  readonly edge: string;
}

interface Circle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

interface Stem {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function number(source: string, pattern: RegExp, what: string): number {
  const found = pattern.exec(source)?.[1];
  if (found === undefined) throw new Error(`mark.svg: no ${what}`);
  return Number(found);
}

// Only the two shapes the mark is made of are read; anything else is refused
// so a redrawn mark cannot be rasterised as half of itself.
function readMark(svg: string): { circle: Circle; stem: Stem; width: number; size: number } {
  const size = number(svg, /viewBox="0 0 (\d+(?:\.\d+)?) \d+(?:\.\d+)?"/u, 'viewBox');
  const width = number(svg, /stroke-width="(\d+(?:\.\d+)?)"/u, 'stroke-width');
  const tag = /<circle\b([^>]*)\/>/u.exec(svg)?.[1];
  if (tag === undefined) throw new Error('mark.svg: no circle');
  const circle = {
    cx: number(tag, /\bcx="(-?\d+(?:\.\d+)?)"/u, 'circle cx'),
    cy: number(tag, /\bcy="(-?\d+(?:\.\d+)?)"/u, 'circle cy'),
    r: number(tag, /\br="(\d+(?:\.\d+)?)"/u, 'circle r'),
  };
  const path = /<path\b[^>]*\bd="([^"]*)"/u.exec(svg)?.[1];
  const line = /^M(-?[\d.]+)[ ,](-?[\d.]+)([vh])(-?[\d.]+)$/u.exec(path ?? '');
  if (line === null)
    throw new Error(`mark.svg: path is not a single M, v or h segment: ${path ?? ''}`);
  const [, x, y, axis, delta] = line;
  const x1 = Number(x);
  const y1 = Number(y);
  const stem =
    axis === 'v'
      ? { x1, y1, x2: x1, y2: y1 + Number(delta) }
      : { x1, y1, x2: x1 + Number(delta), y2: y1 };
  return { circle, stem, width, size };
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function insideTile(x: number, y: number, inset = 0): boolean {
  const radius = TILE_RADIUS - inset;
  const dx = Math.max(TILE_RADIUS - x, 0, x - (MARK_SIZE - TILE_RADIUS));
  const dy = Math.max(TILE_RADIUS - y, 0, y - (MARK_SIZE - TILE_RADIUS));
  return (
    x >= inset &&
    y >= inset &&
    x <= MARK_SIZE - inset &&
    y <= MARK_SIZE - inset &&
    dx * dx + dy * dy <= radius * radius
  );
}

function insideStem(stem: Stem, half: number, x: number, y: number): boolean {
  const [x0, x3] = [Math.min(stem.x1, stem.x2), Math.max(stem.x1, stem.x2)];
  const [y0, y3] = [Math.min(stem.y1, stem.y2), Math.max(stem.y1, stem.y2)];
  const vertical = stem.x1 === stem.x2;
  return vertical
    ? Math.abs(x - stem.x1) <= half && y >= y0 && y <= y3
    : Math.abs(y - stem.y1) <= half && x >= x0 && x <= x3;
}

// The mark in `ink` on a rounded tile of `background`, as straight RGBA with
// the corners transparent, anti-aliased by supersampling.
export function rasteriseMark(svg: string, colours: MarkColours): Buffer {
  const { circle, stem, width, size } = readMark(svg);
  const half = width / 2;
  const scale = (MARK_SIZE * 0.7) / size;
  const origin = (MARK_SIZE - size * scale) / 2;
  const bg = channels(colours.background);
  const ink = channels(colours.ink);
  const edge = channels(colours.edge);
  const out = Buffer.alloc(MARK_SIZE * MARK_SIZE * 4);
  const total = SAMPLES * SAMPLES;
  for (let py = 0; py < MARK_SIZE; py += 1) {
    for (let px = 0; px < MARK_SIZE; px += 1) {
      let tile = 0;
      let inner = 0;
      let drawn = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = px + (sx + 0.5) / SAMPLES;
          const y = py + (sy + 0.5) / SAMPLES;
          if (insideTile(x, y)) tile += 1;
          if (insideTile(x, y, EDGE_WIDTH)) inner += 1;
          const mx = (x - origin) / scale;
          const my = (y - origin) / scale;
          const ring = Math.abs(Math.hypot(mx - circle.cx, my - circle.cy) - circle.r) <= half;
          if (ring || insideStem(stem, half, mx, my)) drawn += 1;
        }
      }
      const inkWeight = tile === 0 ? 0 : drawn / tile;
      const edgeWeight = tile === 0 ? 0 : (tile - inner) / tile;
      const at = (py * MARK_SIZE + px) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const base = bg[channel] ?? 0;
        const value =
          base +
          ((edge[channel] ?? 0) - base) * edgeWeight +
          ((ink[channel] ?? 0) - base) * inkWeight;
        out[at + channel] = Math.round(value);
      }
      out[at + 3] = Math.round((tile / total) * 255);
    }
  }
  return out;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}

export function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rgba.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
