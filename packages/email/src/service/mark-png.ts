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

// Only a circle and straight M-then-h/v/H/V strokes are read; anything else
// is refused so a redrawn mark cannot be rasterised as part of itself.
function readMark(svg: string): { circle: Circle; stems: Stem[]; width: number; size: number } {
  const size = number(svg, /viewBox="0 0 (\d+(?:\.\d+)?) \d+(?:\.\d+)?"/u, 'viewBox');
  const width = number(svg, /stroke-width="(\d+(?:\.\d+)?)"/u, 'stroke-width');
  const tag = /<circle\b([^>]*)\/>/u.exec(svg)?.[1];
  if (tag === undefined) throw new Error('mark.svg: no circle');
  const circle = {
    cx: number(tag, /\bcx="(-?\d+(?:\.\d+)?)"/u, 'circle cx'),
    cy: number(tag, /\bcy="(-?\d+(?:\.\d+)?)"/u, 'circle cy'),
    r: number(tag, /\br="(\d+(?:\.\d+)?)"/u, 'circle r'),
  };
  const stems = [...svg.matchAll(/<path\b[^>]*\bd="([^"]*)"/gu)].map((found) => {
    const path = found[1] ?? '';
    const line = /^M(-?[\d.]+)[ ,](-?[\d.]+)([vhVH])(-?[\d.]+)$/u.exec(path);
    if (line === null)
      throw new Error(`mark.svg: path is not a single M and H, V, h or v segment: ${path}`);
    const [, x, y, axis, value] = line;
    const x1 = Number(x);
    const y1 = Number(y);
    const along = Number(value);
    const absolute = axis === 'H' || axis === 'V';
    const end = absolute ? along : (axis === 'v' ? y1 : x1) + along;
    return axis === 'v' || axis === 'V' ? { x1, y1, x2: x1, y2: end } : { x1, y1, x2: end, y2: y1 };
  });
  if (stems.length === 0) throw new Error('mark.svg: no path');
  return { circle, stems, width, size };
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

// Round caps, as the mark's own stroke-linecap draws them.
function insideStem(stem: Stem, half: number, x: number, y: number): boolean {
  const dx = stem.x2 - stem.x1;
  const dy = stem.y2 - stem.y1;
  const along = ((x - stem.x1) * dx + (y - stem.y1) * dy) / (dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, along));
  return Math.hypot(x - (stem.x1 + t * dx), y - (stem.y1 + t * dy)) <= half;
}

// The mark in `ink` on a rounded tile of `background`, as straight RGBA with
// the corners transparent, anti-aliased by supersampling.
export function rasteriseMark(svg: string, colours: MarkColours): Buffer {
  const { circle, stems, width, size } = readMark(svg);
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
          if (ring || stems.some((stem) => insideStem(stem, half, mx, my))) drawn += 1;
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
