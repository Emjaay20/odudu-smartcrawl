import { PALETTE_KEYS } from '../../packages/contracts/src/index.js';
import { ASSET_LIMITS, contrastFailures } from '../../packages/domain-theme/src/index.js';
import { PAGE_KINDS } from '../../packages/kernel/src/index.js';
import { describe, expect, it } from 'vitest';
import { SLOT_RULES } from '../../apps/admin-console/src/features/branding/service/assets';
import { DEFAULT_PALETTES } from '../../apps/admin-console/src/features/branding/service/palette';
import { MANIFESTS } from '../../apps/admin-console/src/features/branding/service/templates';
import { pairRows } from '../../apps/admin-console/src/features/branding/service/contrast';

// The Branding screens may not import the server's packages, so three things
// are written out twice: the parts each page kind offers, the contrast pairs
// a palette is held to, and each image kind's limits. Each copy is only a
// preview of the server's verdict; this holds it to the server's own.

describe('what the Branding screens show of the server', () => {
  it('lists the parts of every page kind exactly as the renderer’s manifest does', () => {
    expect(Object.keys(MANIFESTS).sort()).toEqual(Object.keys(PAGE_KINDS).sort());
    for (const [kind, manifest] of Object.entries(PAGE_KINDS)) {
      expect(MANIFESTS[kind as keyof typeof MANIFESTS], kind).toEqual({
        required: manifest.required,
        optional: manifest.optional,
        inForm: manifest.inForm,
      });
    }
  });

  it('states each image kind’s limits as the server enforces them', () => {
    for (const [kind, limits] of Object.entries(ASSET_LIMITS)) {
      const rule = SLOT_RULES[kind as keyof typeof SLOT_RULES];
      expect({ bytes: rule.bytes, side: rule.side }, kind).toEqual({
        bytes: limits.maxBytes,
        side: limits.maxSide,
      });
    }
  });

  it('judges a palette by the same pairs as the server, for Instrument’s and for random ones', () => {
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const colour = (): string =>
      `#${Array.from({ length: 3 }, () =>
        Math.floor(next() * 256)
          .toString(16)
          .padStart(2, '0'),
      ).join('')}`;
    const palettes = [
      DEFAULT_PALETTES.light,
      DEFAULT_PALETTES.dark,
      ...Array.from({ length: 200 }, () =>
        Object.fromEntries(PALETTE_KEYS.map((key) => [key, colour()])),
      ),
    ] as (typeof DEFAULT_PALETTES.light)[];
    for (const palette of palettes) {
      const server = contrastFailures({ light: palette })
        .map((failure) => failure.pair)
        .sort();
      const here = pairRows('light', palette)
        .filter((row) => !row.passes)
        .map((row) => row.id.replace('light:', ''))
        .sort();
      expect(here).toEqual(server);
    }
  });

  it('starts a customised palette from colours the server accepts', () => {
    expect(
      contrastFailures({ light: DEFAULT_PALETTES.light, dark: DEFAULT_PALETTES.dark }),
    ).toEqual([]);
  });
});
