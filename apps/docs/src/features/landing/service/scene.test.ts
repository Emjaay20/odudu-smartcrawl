import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '@site/src/features/landing/service/geometry';
import {
  CHIPS,
  checkPath,
  chipStarts,
  flag,
  headTransform,
  lamps,
  passRouteOf,
  skeleton,
} from '@site/src/features/landing/service/scene';

describe('the sign-in scene drawing', () => {
  it('draws a form for the browser and a page for an app, inside the window', () => {
    for (const layout of Object.values(LAYOUTS)) {
      const box = layout.appA;
      for (const kind of ['form', 'app'] as const) {
        const shapes = skeleton(box, box.y + 52, kind);
        expect(shapes.length).toBeGreaterThanOrEqual(5);
        for (const shape of shapes) {
          expect(shape.x).toBeGreaterThanOrEqual(box.x);
          expect(shape.x + (shape.width ?? 0)).toBeLessThanOrEqual(box.x + box.w);
        }
      }
    }
    expect(skeleton(LAYOUTS.wide.device, 0, 'form').map((shape) => shape.look)).toEqual([
      'bar',
      'field',
      'bar',
      'field',
      'cta',
    ]);
  });

  it('puts three lamps in a title bar and centres the chips on the hub', () => {
    expect(lamps({ x: 10, y: 20, w: 100, h: 50 })).toEqual([
      [28, 38],
      [40, 38],
      [52, 38],
    ]);
    const starts = chipStarts(100);
    const last = CHIPS.length - 1;
    const end = (starts[last] ?? 0) + (CHIPS[last]?.width ?? 0);
    expect(100 - (starts[0] ?? 0)).toBeCloseTo(end - 100);
  });

  it('names the route a pass takes and draws marks as the page always has', () => {
    expect(passRouteOf('a')).toBe('ha');
    expect(passRouteOf('b')).toBe('hb');
    expect(passRouteOf(null)).toBeUndefined();
    expect(checkPath(10, 10, 10)).toMatch(/^M5\.8 10\.5L9 13\.4L14\.6/u);
    expect(headTransform([3, 4], 90)).toBe('translate(3 4) rotate(90)');
    expect(flag(true)).toBe('true');
    expect(flag(false)).toBe('false');
  });
});
