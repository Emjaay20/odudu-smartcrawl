import { describe, expect, it } from 'vitest';
import { MAX_OVERRIDE_LENGTH, overrideProblem } from '#/service/override';
import { createTranslators } from '#/service/translators';

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const en = {
  greeting: 'Hello, {name}',
  who: '{client} asks for access',
  plain: "Can't go on",
};
const EN = { tag: 'en', dir: 'ltr' } as const;
const FR = { tag: 'fr', dir: 'ltr' } as const;

describe('createTranslators', () => {
  const { t, tHtml, bdi } = createTranslators({ en, fr: { greeting: 'Bonjour, {name}' } }, escape);

  it('escapes a plain value once, inside the sentence', () => {
    expect(tHtml(EN, 'greeting', { name: '<b>&' })).toBe('Hello, &lt;b&gt;&amp;');
  });

  it('isolates a value in its own bdi, escaped, and nowhere else', () => {
    expect(tHtml(EN, 'who', {}, { client: '<i>&' })).toBe(
      '<bdi>&lt;i&gt;&amp;</bdi> asks for access',
    );
    expect(bdi('<x>')).toBe('<bdi>&lt;x&gt;</bdi>');
  });

  it('keeps a plain value from naming an isolated slot', () => {
    const out = tHtml(EN, 'greeting', { name: 'client' }, { client: 'x' });
    expect(out).toBe('Hello, client');
  });

  it('formats plain text without escaping, and falls back per key', () => {
    expect(t(EN, 'plain')).toBe("Can't go on");
    expect(t(FR, 'greeting', { name: 'a' })).toBe('Bonjour, a');
    expect(t(FR, 'plain')).toBe("Can't go on");
  });
});

describe('a tenant override carried on the locale', () => {
  const { t, tHtml } = createTranslators({ en, fr: { greeting: 'Bonjour, {name}' } }, escape);
  const withOverrides = (tag: string, overrides: Record<string, string>) => ({
    tag,
    dir: 'ltr' as const,
    overrides,
  });

  it('is read before the catalogue, in the locale it was written for', () => {
    const fr = withOverrides('fr', { greeting: 'Salut {name}' });
    expect(t(fr, 'greeting', { name: 'Zo' })).toBe('Salut Zo');
    expect(tHtml(fr, 'greeting', { name: 'Zo' })).toBe('Salut Zo');
  });

  it('leaves every other key to the catalogue', () => {
    expect(t(withOverrides('fr', { greeting: 'Salut' }), 'plain')).toBe("Can't go on");
  });

  it('is escaped like a catalogue value, markup and all', () => {
    const locale = withOverrides('en', { plain: '<script>alert(1)</script> & <b>x</b>' });
    expect(tHtml(locale, 'plain')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;x&lt;/b&gt;',
    );
    expect(t(locale, 'plain')).toBe('<script>alert(1)</script> & <b>x</b>');
  });

  it('keeps a value a person typed out of the isolated slots', () => {
    const locale = withOverrides('en', { who: '{client} wants in' });
    expect(tHtml(locale, 'who', {}, { client: '<i>' })).toBe('<bdi>&lt;i&gt;</bdi> wants in');
  });

  it('falls back to the catalogue when the override cannot be formatted', () => {
    const missing = withOverrides('en', { greeting: 'Hi {nobody}' });
    expect(t(missing, 'greeting', { name: 'a' })).toBe('Hello, a');
    const broken = withOverrides('en', { greeting: 'Hi {name' });
    expect(t(broken, 'greeting', { name: 'a' })).toBe('Hello, a');
  });

  it('ignores a key the map does not hold as its own, however it is spelled', () => {
    expect(t(withOverrides('en', {}), 'plain')).toBe("Can't go on");
    const inherited = Object.create({ plain: 'x' }) as Record<string, string>;
    expect(t({ tag: 'en', dir: 'ltr', overrides: inherited }, 'plain')).toBe("Can't go on");
  });
});

describe('overrideProblem', () => {
  it('accepts plain text, a placeholder and a plural', () => {
    expect(overrideProblem('Welcome back, {name}')).toBeNull();
    expect(overrideProblem('{n, plural, one {# try} other {# tries}}')).toBeNull();
  });

  it('accepts markup, which is shown as text rather than rendered', () => {
    expect(overrideProblem('<b>Hello</b>')).toBeNull();
  });

  it.each([
    ['', 'empty'],
    ['x'.repeat(MAX_OVERRIDE_LENGTH + 1), 'long'],
    ['Hi {name', 'ICU'],
    ['{n, plural, one {x}}', 'ICU'],
    ['a\uE000client\uE001', 'reserved'],
  ])('refuses %j', (message) => {
    expect(overrideProblem(message)).toEqual(expect.any(String));
  });

  it('accepts exactly the longest length', () => {
    expect(overrideProblem('x'.repeat(MAX_OVERRIDE_LENGTH))).toBeNull();
  });
});
