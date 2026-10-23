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

  it('drops a value outside the tag alphabet or length rather than refusing the request, and keeps words that merely look like tags', () => {
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

describe('parseUiLocales on a very long value', () => {
  it('stops reading at the sixteenth tag', () => {
    const huge = `${Array.from({ length: 16 }, (_, i) => `a${String(i)}`).join(' ')} ${'z '.repeat(500_000)}`;
    expect(parseUiLocales(huge)).toHaveLength(MAX_UI_LOCALES);
  });
});
