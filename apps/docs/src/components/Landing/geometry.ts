// The sign-in scene's geometry, the paths the signals travel and which parts
// of the picture are active at each step. Pure, so a test can read it.

export type LayoutName = 'wide' | 'tall';
export type Point = readonly [number, number];
export type RouteId = 'dh' | 'da' | 'db' | 'ha' | 'hb' | 'bh';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Route {
  readonly points: readonly Point[];
  // Where the arrowhead sits and which way it points, in degrees.
  readonly head: { readonly at: Point; readonly angle: number };
}

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly device: Box;
  readonly hub: Box;
  readonly appA: Box;
  readonly appB: Box;
  readonly routes: Readonly<Record<RouteId, Route>>;
}

const SAMPLES = 14;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// An S between two points, leaving and arriving along `axis`.
function curve(a: Point, b: Point, axis: 'h' | 'v'): Point[] {
  return Array.from({ length: SAMPLES + 1 }, (_, index) => {
    const t = index / SAMPLES;
    const eased = smooth(t);
    return axis === 'h'
      ? ([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * eased] as const)
      : ([a[0] + (b[0] - a[0]) * eased, a[1] + (b[1] - a[1]) * t] as const);
  });
}

function at(list: readonly Point[], index: number): Point {
  const found = list[index];
  if (found === undefined) throw new Error(`no point at ${String(index)}`);
  return found;
}

// A polyline through `corners` with each corner rounded by `radius`.
function rail(corners: readonly Point[], radius: number): Point[] {
  const out: Point[] = [at(corners, 0)];
  for (let index = 1; index < corners.length - 1; index += 1) {
    const [px, py] = at(corners, index - 1);
    const [cx, cy] = at(corners, index);
    const [nx, ny] = at(corners, index + 1);
    const before: Point = [cx - Math.sign(cx - px) * radius, cy - Math.sign(cy - py) * radius];
    const after: Point = [cx + Math.sign(nx - cx) * radius, cy + Math.sign(ny - cy) * radius];
    out.push(before);
    for (let step = 1; step < 6; step += 1) {
      const t = step / 6;
      out.push([
        (1 - t) ** 2 * before[0] + 2 * (1 - t) * t * cx + t ** 2 * after[0],
        (1 - t) ** 2 * before[1] + 2 * (1 - t) * t * cy + t ** 2 * after[1],
      ]);
    }
    out.push(after);
  }
  out.push(at(corners, corners.length - 1));
  return out;
}

const WIDE: Layout = {
  width: 960,
  height: 440,
  device: { x: 30, y: 120, w: 200, h: 210 },
  hub: { x: 340, y: 80, w: 280, h: 280 },
  appA: { x: 730, y: 50, w: 200, h: 150 },
  appB: { x: 750, y: 220, w: 200, h: 150 },
  routes: {
    dh: { points: curve([230, 225], [338, 215], 'h'), head: { at: [338, 215], angle: 0 } },
    da: {
      points: rail(
        [
          [130, 118],
          [130, 24],
          [830, 24],
          [830, 48],
        ],
        22,
      ),
      head: { at: [830, 48], angle: 90 },
    },
    db: {
      points: rail(
        [
          [130, 332],
          [130, 412],
          [850, 412],
          [850, 372],
        ],
        22,
      ),
      head: { at: [850, 372], angle: -90 },
    },
    ha: { points: curve([622, 140], [728, 125], 'h'), head: { at: [728, 125], angle: 0 } },
    hb: { points: curve([622, 300], [748, 295], 'h'), head: { at: [748, 295], angle: 0 } },
    bh: { points: curve([748, 295], [622, 300], 'h'), head: { at: [622, 300], angle: 180 } },
  },
};

const TALL: Layout = {
  width: 360,
  height: 800,
  device: { x: 80, y: 10, w: 200, h: 170 },
  hub: { x: 30, y: 250, w: 300, h: 290 },
  appA: { x: 18, y: 610, w: 160, h: 120 },
  appB: { x: 182, y: 664, w: 160, h: 120 },
  routes: {
    dh: { points: curve([180, 182], [180, 248], 'v'), head: { at: [180, 248], angle: 90 } },
    da: {
      points: rail(
        [
          [78, 95],
          [8, 95],
          [8, 670],
          [16, 670],
        ],
        20,
      ),
      head: { at: [16, 670], angle: 0 },
    },
    db: {
      points: rail(
        [
          [282, 95],
          [352, 95],
          [352, 724],
          [344, 724],
        ],
        20,
      ),
      head: { at: [344, 724], angle: 180 },
    },
    ha: { points: curve([100, 542], [98, 608], 'v'), head: { at: [98, 608], angle: 90 } },
    hb: { points: curve([260, 542], [262, 662], 'v'), head: { at: [262, 662], angle: 90 } },
    bh: { points: curve([262, 662], [260, 542], 'v'), head: { at: [260, 542], angle: -90 } },
  },
};

export const LAYOUTS: Readonly<Record<LayoutName, Layout>> = { wide: WIDE, tall: TALL };

export function pathData(points: readonly Point[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join('');
}

export function keyframeName(
  layout: LayoutName,
  route: RouteId,
  kind: 'travel' | 'pass' = 'travel',
): string {
  return `${kind}-${layout}-${route}`;
}

// One @keyframes per route: a signal leaves the start, fades in and out, and
// follows the same samples as the line it rides. Transform and opacity only.
export function travelKeyframes(): string {
  const blocks: string[] = [];
  for (const layout of ['wide', 'tall'] as const) {
    for (const [id, route] of Object.entries(LAYOUTS[layout].routes)) {
      const first = at(route.points, 0);
      for (const kind of id === 'ha' || id === 'hb'
        ? (['travel', 'pass'] as const)
        : (['travel'] as const)) {
        const frames = route.points.map(([x, y], index) => {
          const at = (index / (route.points.length - 1)) * 100;
          const ramp = at < 8 ? at / 8 : 1;
          const opacity = kind === 'pass' || at <= 92 ? ramp : (100 - at) / 8;
          return `${at.toFixed(2)}%{transform:translate(${(x - first[0]).toFixed(1)}px,${(y - first[1]).toFixed(1)}px);opacity:${opacity.toFixed(2)}}`;
        });
        blocks.push(`@keyframes ${keyframeName(layout, id as RouteId, kind)}{${frames.join('')}}`);
      }
    }
  }
  return blocks.join('\n');
}

export type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Activity {
  readonly device: boolean;
  readonly hub: boolean;
  readonly appA: boolean;
  readonly appB: boolean;
  readonly routes: readonly RouteId[];
  readonly pass: 'a' | 'b' | null;
  readonly chips: boolean;
  readonly pulse: boolean;
  readonly bArrived: boolean;
}

const NONE: Activity = {
  device: false,
  hub: false,
  appA: false,
  appB: false,
  routes: [],
  pass: null,
  chips: false,
  pulse: false,
  bArrived: true,
};

// Step 0 is the composed picture at rest: nothing moving, everything in place.
export const ACTIVITY: Readonly<Record<Step, Activity>> = {
  0: NONE,
  1: { ...NONE, device: true, appA: true, routes: ['da'], bArrived: false },
  2: { ...NONE, device: true, hub: true, routes: ['dh'], bArrived: false },
  3: { ...NONE, hub: true, chips: true, pulse: true, bArrived: false },
  4: { ...NONE, hub: true, appA: true, routes: ['ha'], pass: 'a', bArrived: false },
  5: { ...NONE, device: true, appB: true, routes: ['db'] },
  6: { ...NONE, hub: true, appB: true, routes: ['bh', 'hb'], pass: 'b', pulse: true },
  7: { ...NONE, hub: true, appA: true, appB: true, routes: ['ha', 'hb'] },
};

export interface Beat {
  readonly label: string;
  readonly caption: string;
  readonly ms: number;
  readonly claims: readonly string[];
}

export const BEATS: readonly Beat[] = [
  { label: 'Open the app', caption: 'A person opens your app.', ms: 2200, claims: [] },
  {
    label: 'Go to Odudu',
    caption: 'Your app sends them to Odudu to sign in.',
    ms: 2200,
    claims: [],
  },
  {
    label: 'Sign in once',
    caption:
      "They sign in on Odudu's own page. Odudu supports passwords, passkeys and codes from an authenticator app.",
    ms: 3600,
    claims: ['passwords', 'passkeys', 'authenticator-codes'],
  },
  {
    label: 'Back with a signed pass',
    caption: 'Odudu sends them back with a signed pass, and your app lets them in.',
    ms: 2600,
    claims: [],
  },
  {
    label: 'Open a second app',
    caption: 'Later, they open a second app, and it sends them to Odudu too.',
    ms: 2200,
    claims: [],
  },
  {
    label: 'Already signed in',
    caption:
      'Odudu sees they are already signed in, so it shows no sign-in page. Straight back, with no password asked. Sign in once, and use every app of that tenant that trusts Odudu.',
    ms: 3400,
    claims: ['single-sign-on'],
  },
  {
    label: 'Signed out where registered',
    caption: 'Sign out of one, and the apps that registered for it are told.',
    ms: 2600,
    claims: ['back-channel-logout'],
  },
];
