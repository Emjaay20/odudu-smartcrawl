import type { Box, Point, RouteId } from '@site/src/features/landing/service/geometry';

// The arithmetic of the sign-in scene's drawing, apart from the drawing.

export type ShapeClass = 'bar' | 'field' | 'cta' | 'avatar' | 'block';

export interface Shape {
  readonly kind: 'rect' | 'circle';
  readonly look: ShapeClass;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly radius: number;
}

// What a window shows: a form for the browser, a page for an app.
export function skeleton(box: Box, top: number, kind: 'form' | 'app'): Shape[] {
  const x = box.x + 16;
  const w = box.w - 32;
  if (kind === 'form') {
    return [
      { kind: 'rect', look: 'bar', x, y: top, width: w * 0.34, height: 7, radius: 3.5 },
      { kind: 'rect', look: 'field', x, y: top + 14, width: w, height: 24, radius: 8 },
      { kind: 'rect', look: 'bar', x, y: top + 52, width: w * 0.42, height: 7, radius: 3.5 },
      { kind: 'rect', look: 'field', x, y: top + 66, width: w, height: 24, radius: 8 },
      { kind: 'rect', look: 'cta', x, y: top + 106, width: w * 0.5, height: 26, radius: 9 },
    ];
  }
  const block = Math.min(box.h * 0.2, 26);
  return [
    { kind: 'circle', look: 'avatar', x: x + 9, y: top + 9, radius: 9 },
    { kind: 'rect', look: 'bar', x: x + 26, y: top + 2, width: w * 0.5, height: 7, radius: 3.5 },
    { kind: 'rect', look: 'bar', x: x + 26, y: top + 13, width: w * 0.3, height: 6, radius: 3 },
    { kind: 'rect', look: 'block', x, y: top + 28, width: w, height: block, radius: 8 },
    {
      kind: 'rect',
      look: 'bar',
      x,
      y: top + 28 + block + 10,
      width: w * 0.72,
      height: 7,
      radius: 3.5,
    },
  ];
}

// The three lamps in a window's title bar.
export function lamps(box: Box): Point[] {
  return [0, 1, 2].map((index) => [box.x + 18 + index * 12, box.y + 18] as const);
}

export interface Chip {
  readonly label: string;
  readonly width: number;
  readonly claim: string;
}

export const CHIPS: readonly Chip[] = [
  { label: 'Password', width: 78, claim: 'passwords' },
  { label: 'Passkey', width: 68, claim: 'passkeys' },
  { label: 'Authenticator', width: 98, claim: 'authenticator-codes' },
];

const CHIP_GAP = 6;

// Where each chip starts so that the row is centred on `centre`.
export function chipStarts(centre: number): number[] {
  const total = CHIPS.reduce((sum, chip) => sum + chip.width, 0) + 2 * CHIP_GAP;
  return CHIPS.map(
    (_, index) =>
      centre -
      total / 2 +
      CHIPS.slice(0, index).reduce((sum, chip) => sum + chip.width + CHIP_GAP, 0),
  );
}

export const RING_SCALES: readonly number[] = [0.74, 0.98, 1.22];

const PASS_ROUTES: Readonly<Record<'a' | 'b', RouteId>> = { a: 'ha', b: 'hb' };

export function passRouteOf(pass: 'a' | 'b' | null): RouteId | undefined {
  return pass === null ? undefined : PASS_ROUTES[pass];
}

// A check mark drawn inside a circle of radius `r` centred on (x, y).
export function checkPath(x: number, y: number, r: number): string {
  const at = (dx: number, dy: number): string => `${String(x + dx)} ${String(y + dy)}`;
  return `M${at(-r * 0.42, 0.5)}L${at(-r * 0.1, r * 0.34)}L${at(r * 0.46, -r * 0.36)}`;
}

// An arrowhead pointing along `angle`, placed at the end of a route.
export function headTransform(at: Point, angle: number): string {
  return `translate(${String(at[0])} ${String(at[1])}) rotate(${String(angle)})`;
}

export function flag(on: boolean): string {
  return on ? 'true' : 'false';
}
