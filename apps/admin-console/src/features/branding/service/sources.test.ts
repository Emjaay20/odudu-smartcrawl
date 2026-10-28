import type { ThemeView } from '@odudu/contracts/admin';
import { describe, expect, it } from 'vitest';
import { sourceReading } from '#/features/branding/service';
import { draftedView, themeView } from '#/testing/brandingFixtures';

describe('sourceReading', () => {
  it('names the draft’s layer beside the published one, per piece', () => {
    const view = draftedView() as ThemeView;
    expect(sourceReading({ kind: 'tenant' }, view, 'assets.logo')).toBe(
      'Draft: this tenant · Published: Instrument’s default',
    );
  });

  it('says only what is published when there is no draft, and defaults a piece nobody sets', () => {
    expect(sourceReading({ kind: 'tenant' }, themeView() as ThemeView, 'tokens.font')).toBe(
      'Published: Instrument’s default',
    );
  });

  it('speaks of the tenant as the layer below at a client’s scope', () => {
    const view = themeView({ sources: { 'tokens.light': 'tenant' } }) as ThemeView;
    expect(sourceReading({ kind: 'client', id: 'c' }, view, 'tokens.light')).toBe(
      'Published: the tenant',
    );
  });
});
