import { describe, expect, it } from 'vitest';

import { contrastFailures, contrastRatio } from '#/service/contrast';
import { type Palette } from '#/service/body';

const PASSING: Palette = {
  surfacePage: '#ffffff',
  surfacePanel: '#ffffff',
  inkPrimary: '#000000',
  inkMuted: '#767676',
  signalActive: '#ffffff',
  signalActiveInk: '#000000',
  borderStrong: '#949494',
  focusRing: '#949494',
};

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });

  it('does not depend on which colour is the foreground', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBe(contrastRatio('#ffffff', '#767676'));
  });

  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#787878', '#ffffff')).toBeCloseTo(4.42, 2);
    expect(contrastRatio('#949494', '#ffffff')).toBeCloseTo(3.03, 2);
    expect(contrastRatio('#979797', '#ffffff')).toBeCloseTo(2.92, 2);
  });
});

describe('contrastFailures', () => {
  it('passes a palette whose pairs all meet their threshold', () => {
    expect(contrastFailures({ light: PASSING, dark: PASSING })).toEqual([]);
  });

  it('flags a 4.4:1 text pair and passes 4.5:1', () => {
    const failing = contrastFailures({ light: { ...PASSING, inkMuted: '#787878' } });
    expect(failing).toHaveLength(2);
    expect(failing.map((f) => f.pair)).toEqual(['inkMuted/surfacePage', 'inkMuted/surfacePanel']);
    expect(failing[0]).toMatchObject({ scheme: 'light', required: 4.5 });
    expect(failing[0]?.ratio).toBeCloseTo(4.42, 2);
    expect(contrastFailures({ light: PASSING })).toEqual([]);
  });

  it('flags a 2.9:1 focus ring and passes 3:1', () => {
    const failing = contrastFailures({ dark: { ...PASSING, focusRing: '#979797' } });
    expect(failing.map((f) => f.pair)).toEqual(['focusRing/surfacePage', 'focusRing/surfacePanel']);
    expect(failing[0]).toMatchObject({ scheme: 'dark', required: 3 });
    expect(failing[0]?.ratio).toBeCloseTo(2.92, 2);
    expect(contrastFailures({ dark: { ...PASSING, focusRing: '#949494' } })).toEqual([]);
  });

  it('holds the border to 3:1 and the primary action to 4.5:1', () => {
    const failing = contrastFailures({
      light: {
        ...PASSING,
        borderStrong: '#cccccc',
        signalActive: '#777777',
        signalActiveInk: '#ffffff',
      },
    });
    expect(failing.map((f) => [f.pair, f.required])).toEqual([
      ['signalActiveInk/signalActive', 4.5],
      ['borderStrong/surfacePage', 3],
    ]);
  });

  it('checks only the groups that are present', () => {
    expect(contrastFailures({})).toEqual([]);
    expect(contrastFailures({ font: 'IBM Plex Mono' })).toEqual([]);
  });
});
