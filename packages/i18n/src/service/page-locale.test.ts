import { describe, expect, it } from 'vitest';
import { negotiatePageLocale } from '#/service/page-locale';

describe('negotiatePageLocale', () => {
  it('answers en for a request that says nothing', () => {
    expect(negotiatePageLocale()).toEqual({ tag: 'en', dir: 'ltr' });
  });

  it('negotiates on Accept-Language alone when given nothing else', () => {
    expect(negotiatePageLocale({ acceptLanguage: 'ar', supported: ['en', 'ar'] })).toEqual({
      tag: 'ar',
      dir: 'rtl',
    });
  });

  it('orders ui_locales, the subject (once authenticated), the tenant default, then the browser', () => {
    const supported = ['en', 'fr', 'de', 'es'];
    const base = { supported, acceptLanguage: 'es' };
    expect(negotiatePageLocale({ ...base, tenantDefault: 'de' }).tag).toBe('de');
    expect(
      negotiatePageLocale({
        ...base,
        tenantDefault: 'de',
        subjectLocale: 'fr',
        authenticated: true,
      }).tag,
    ).toBe('fr');
    expect(
      negotiatePageLocale({
        ...base,
        tenantDefault: 'de',
        subjectLocale: 'fr',
        authenticated: false,
      }).tag,
    ).toBe('de');
    expect(
      negotiatePageLocale({ ...base, uiLocales: ['es'], subjectLocale: 'fr', authenticated: true })
        .tag,
    ).toBe('es');
  });

  it('accepts a header as a request yields it and never throws on garbage', () => {
    const supported = ['en', 'fr'];
    expect(negotiatePageLocale({ acceptLanguage: ['de', 'fr'], supported }).tag).toBe('fr');
    for (const garbage of [
      undefined,
      null,
      '',
      ',,,;;;',
      'x'.repeat(5000),
      '\u0000\r\n',
      ['', 7 as never],
    ]) {
      expect(() => negotiatePageLocale({ acceptLanguage: garbage, supported })).not.toThrow();
      expect(negotiatePageLocale({ acceptLanguage: garbage, supported }).tag).toBe('en');
    }
  });
});
