import { describe, expect, it } from 'vitest';
import { pageHeaders, withPageTheme } from '#/page';
import { PAGE_THEME_COOKIE, pageThemeFromCookies } from '#/page-theme';

describe('the theme a cookie names', () => {
  it('reads light and dark and nothing else', () => {
    expect(pageThemeFromCookies('odudu-theme=light')).toBe('light');
    expect(pageThemeFromCookies('a=1; odudu-theme=dark; b=2')).toBe('dark');
    expect(PAGE_THEME_COOKIE).toBe('odudu-theme');
  });

  it.each([
    ['LIGHT', 'odudu-theme=LIGHT'],
    ['a value with a suffix', 'odudu-theme=light evil'],
    ['a value with a comma', 'odudu-theme=light,dark'],
    ['a markup break-out', 'odudu-theme=x"><script>'],
    ['an encoded value', 'odudu-theme=%6Cight'],
    ['a quoted value', 'odudu-theme="light"'],
    ['an empty value', 'odudu-theme='],
    ['system', 'odudu-theme=system'],
    ['another name', 'xodudu-theme=light; odudu-theme-x=dark'],
    ['a name with no value', 'odudu-theme'],
  ])('ignores %s', (_label, header) => {
    expect(pageThemeFromCookies(header)).toBeUndefined();
  });

  it('reads a cookie beside it as another cookie, never as part of the value', () => {
    expect(pageThemeFromCookies('odudu-theme=light; evil')).toBe('light');
  });

  it('answers nothing when the name is present twice', () => {
    expect(pageThemeFromCookies('odudu-theme=light; odudu-theme=dark')).toBeUndefined();
    expect(pageThemeFromCookies('odudu-theme=light; odudu-theme=light')).toBeUndefined();
  });

  it('answers nothing for a header that is absent, not text or too long', () => {
    expect(pageThemeFromCookies(undefined)).toBeUndefined();
    expect(pageThemeFromCookies(42)).toBeUndefined();
    expect(pageThemeFromCookies(`odudu-theme=light; pad=${'x'.repeat(9000)}`)).toBeUndefined();
    expect(pageThemeFromCookies(`odudu-theme=${'x'.repeat(9000)}`)).toBeUndefined();
  });

  it('reads a header a transport handed over as a list', () => {
    expect(pageThemeFromCookies(['a=1', 'odudu-theme=dark'])).toBe('dark');
  });
});

describe('a locale carrying a theme', () => {
  const locale = { tag: 'fr', dir: 'ltr' as const };

  it('adds the theme the cookie names and keeps the language', () => {
    expect(withPageTheme(locale, 'odudu-theme=dark')).toEqual({ ...locale, theme: 'dark' });
  });

  it('is the locale itself, with no theme key, when there is none', () => {
    const plain = withPageTheme(locale, 'odudu-theme=nope');
    expect(plain).toEqual(locale);
    expect('theme' in plain).toBe(false);
  });

  it('refuses to send a page whose theme is not on the allowlist', () => {
    const page = {
      html: '',
      body: '',
      title: '',
      script: null,
      frames: [],
      locale: { ...locale, theme: 'x"><script>' as never },
    };
    expect(() => pageHeaders(page)).toThrow(/theme/u);
  });
});
