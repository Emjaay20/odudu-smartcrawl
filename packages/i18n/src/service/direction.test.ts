import { describe, expect, it } from 'vitest';
import { directionOf } from '#/service/direction';

function platformDirection(tag: string): string | undefined {
  const locale: unknown = new Intl.Locale(tag);
  if (typeof locale !== 'object' || locale === null) return undefined;
  const info =
    'getTextInfo' in locale && typeof locale.getTextInfo === 'function'
      ? (locale.getTextInfo as () => unknown).call(locale)
      : 'textInfo' in locale
        ? locale.textInfo
        : undefined;
  if (typeof info !== 'object' || info === null || !('direction' in info)) return undefined;
  return typeof info.direction === 'string' ? info.direction : undefined;
}

describe('directionOf', () => {
  it('knows the rtl languages the table lists', () => {
    for (const tag of ['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'ar-EG', 'he-IL', 'AR']) {
      expect(directionOf(tag)).toBe('rtl');
    }
    for (const tag of ['en', 'fr', 'de-CH', 'zh-Hant', 'ja']) {
      expect(directionOf(tag)).toBe('ltr');
    }
  });

  it('lets an explicit script decide', () => {
    expect(directionOf('az-Arab')).toBe('rtl');
    expect(directionOf('ur-Latn')).toBe('ltr');
  });

  it('agrees with the platform', () => {
    for (const tag of ['ar', 'he', 'fa', 'ur', 'en']) {
      expect(directionOf(tag)).toBe(platformDirection(tag));
    }
  });

  it('answers ltr for an unknown tag', () => {
    for (const tag of ['', 'zz', '../../etc', 'x-private']) {
      expect(directionOf(tag)).toBe('ltr');
    }
  });
});
