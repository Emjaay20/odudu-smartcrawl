import { describe, expect, it } from 'vitest';
import {
  ACTIVITY,
  BEATS,
  LAYOUTS,
  keyframeName,
  pathData,
  travelKeyframes,
} from '@site/src/features/landing/service/geometry';

describe('the sign-in scene geometry', () => {
  it('has seven beats, each with a caption, a time and claims that are named', () => {
    expect(BEATS).toHaveLength(7);
    for (const beat of BEATS) {
      expect(beat.caption.length).toBeGreaterThan(15);
      expect(beat.ms).toBeGreaterThan(1000);
    }
  });

  it('has an activity for rest and for every beat', () => {
    expect(Object.keys(ACTIVITY)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(ACTIVITY[0].routes).toEqual([]);
    expect(ACTIVITY[3].chips).toBe(true);
    expect(ACTIVITY[6].chips).toBe(false);
  });

  it('draws each route from its first sample to its last and ends it with an arrowhead', () => {
    for (const layout of Object.values(LAYOUTS)) {
      for (const route of Object.values(layout.routes)) {
        const first = route.points[0];
        const last = route.points[route.points.length - 1];
        expect(pathData(route.points).startsWith(`M${(first?.[0] ?? 0).toFixed(1)}`)).toBe(true);
        expect(route.head.at).toEqual(last);
      }
    }
  });

  it('writes one set of keyframes per route and layout, passes only for the two returns', () => {
    const css = travelKeyframes();
    expect(css.match(/@keyframes travel-/gu)).toHaveLength(12);
    expect(css.match(/@keyframes pass-/gu)).toHaveLength(4);
    expect(css).toContain(`@keyframes ${keyframeName('wide', 'ha', 'pass')}`);
    expect(css).not.toContain('pass-wide-da');
  });
});
