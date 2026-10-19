import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { catalogue, en, t, tHtml, translators } from '#/view/messages';

describe('the page catalogue', () => {
  it('holds en and nothing else until another language ships', () => {
    expect(catalogue.locales).toEqual(['en']);
  });

  it('carries no markup in any message', () => {
    for (const [id, message] of Object.entries(en)) {
      expect(message, id).not.toMatch(/<\/?[A-Za-z]/u);
    }
  });
});

describe('tHtml', () => {
  it('escapes a plain value once, inside the sentence', () => {
    expect(tHtml(DEFAULT_PAGE_LOCALE, 'login.unsupportedStep', { form: '<b>&' })).toBe(
      'Unsupported sign-in step: &lt;b&gt;&amp;',
    );
  });

  it('isolates a user value in its own bdi, escaped, and nowhere else', () => {
    const out = tHtml(DEFAULT_PAGE_LOCALE, 'consent.heading', {}, { client: '<i>&"\'' });
    expect(out).toBe('<bdi>&lt;i&gt;&amp;&quot;&#39;</bdi> is asking for access');
  });

  it('cannot be made to open an isolated value by a value that holds the marker', () => {
    const out = tHtml(
      DEFAULT_PAGE_LOCALE,
      'login.unsupportedStep',
      { form: 'client' },
      { client: 'x' },
    );
    expect(out).not.toContain('');
    expect(out.match(/<bdi>/gu)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('formats plain text for a title without escaping it', () => {
    expect(t(DEFAULT_PAGE_LOCALE, 'emailUnverified.heading')).toBe("Can't sign in yet");
    expect(tHtml(DEFAULT_PAGE_LOCALE, 'emailUnverified.heading')).toBe('Can&#39;t sign in yet');
  });

  it('shows English for a locale it does not hold, per key', () => {
    const french = translators({ en, fr: { 'throttled.title': 'Trop de tentatives' } });
    expect(french.t({ tag: 'fr', dir: 'ltr' }, 'throttled.title')).toBe('Trop de tentatives');
    expect(french.t({ tag: 'fr', dir: 'ltr' }, 'throttled.goBack')).toBe(en['throttled.goBack']);
    expect(french.t({ tag: 'xx', dir: 'ltr' }, 'throttled.title')).toBe(en['throttled.title']);
  });
});
