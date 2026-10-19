import { describe, expect, it } from 'vitest';
import { MAX_UI_LOCALES, parseUiLocales } from '#/service/ui-locales';

describe('parseUiLocales', () => {
  it('reads the space-separated preference list in order', () => {
    expect(parseUiLocales('fr-CA fr en')).toEqual(['fr-CA', 'fr', 'en']);
  });

  it('answers an empty list for an absent or blank parameter', () => {
    expect(parseUiLocales(undefined)).toEqual([]);
    expect(parseUiLocales('')).toEqual([]);
    expect(parseUiLocales('   ')).toEqual([]);
  });

  it('drops a value that could not be a language tag rather than refusing the request', () => {
    expect(parseUiLocales('../../etc fr "><script> en\tx zz_ZZ')).toEqual(['fr']);
    expect(parseUiLocales('not a language tag at all')).toEqual([
      'not',
      'a',
      'language',
      'tag',
      'at',
      'all',
    ]);
  });

  it('drops a tag longer than 35 characters', () => {
    expect(parseUiLocales(`${'x'.repeat(36)} en`)).toEqual(['en']);
  });

  it('keeps at most the first MAX_UI_LOCALES tags', () => {
    const many = Array.from({ length: 200 }, (_, i) => `a${String(i)}`).join(' ');
    expect(parseUiLocales(many)).toHaveLength(MAX_UI_LOCALES);
  });

  it('lists a tag once', () => {
    expect(parseUiLocales('fr en fr')).toEqual(['fr', 'en']);
  });
});
