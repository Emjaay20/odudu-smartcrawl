import { describe, expect, it } from 'vitest';
import {
  defaultChoices,
  languageSettingsOf,
  languagesHold,
  languagesOf,
  languagesRequest,
  openingLocale,
  shownLocale,
  supportedChoices,
  SHIPPED_LANGUAGES,
} from '#/features/branding/service';

describe('the shipped languages', () => {
  it('are English and Arabic', () => {
    expect(SHIPPED_LANGUAGES).toEqual(['en', 'ar']);
  });

  it('are offered first, then any other the tenant already supports, each once', () => {
    expect(supportedChoices(['fr', 'en']).map((choice) => choice.id)).toEqual(['en', 'ar', 'fr']);
  });
});

describe('the settings as languages', () => {
  it('read the two settings out of the whole record, whatever else is in it', () => {
    expect(
      languageSettingsOf({ supported_locales: ['en', 3, 'ar'], default_locale: null, other: 1 }),
    ).toEqual({ supported_locales: ['en', 'ar'], default_locale: null });
    expect(languageSettingsOf({})).toEqual({ supported_locales: [], default_locale: null });
  });

  it('show no default as an empty choice', () => {
    expect(languagesOf({ supported_locales: ['en'], default_locale: null }).default_locale).toBe(
      '',
    );
  });
});

describe('the default language choices', () => {
  it('offer "the browser decides" only while that is what is saved', () => {
    expect(defaultChoices(['en', 'ar'], '').map((choice) => choice.id)).toEqual(['', 'en', 'ar']);
    expect(defaultChoices(['en', 'ar'], 'ar').map((choice) => choice.id)).toEqual(['en', 'ar']);
  });
});

describe('what holds the section', () => {
  it('is no language at all, and a default that is not offered', () => {
    expect(languagesHold({ supported_locales: [], default_locale: '' })).toMatch(/at least one/u);
    expect(languagesHold({ supported_locales: ['en'], default_locale: 'ar' })).toMatch(
      /must be one of the supported/u,
    );
    expect(
      languagesHold({ supported_locales: ['en', 'ar'], default_locale: 'ar' }),
    ).toBeUndefined();
    expect(languagesHold({ supported_locales: ['en'], default_locale: '' })).toBeUndefined();
  });
});

describe('the request', () => {
  it('carries what changed, and never clears a default', () => {
    expect(languagesRequest({ supported_locales: ['en', 'ar'] })).toEqual({
      supported_locales: ['en', 'ar'],
    });
    expect(languagesRequest({ default_locale: 'ar' })).toEqual({ default_locale: 'ar' });
    expect(languagesRequest({ default_locale: '' })).toEqual({});
  });
});

describe('the language the overrides open on', () => {
  it('is the default when it is offered, else the first, else English', () => {
    expect(openingLocale({ supported_locales: ['en', 'ar'], default_locale: 'ar' })).toBe('ar');
    expect(openingLocale({ supported_locales: ['en', 'ar'], default_locale: null })).toBe('en');
    expect(openingLocale({ supported_locales: [], default_locale: null })).toBe('en');
  });

  it('is the one picked while it is still offered', () => {
    expect(shownLocale('ar', ['en', 'ar'], 'en')).toBe('ar');
    expect(shownLocale('fr', ['en', 'ar'], 'en')).toBe('en');
    expect(shownLocale(null, ['en', 'ar'], 'en')).toBe('en');
  });
});
