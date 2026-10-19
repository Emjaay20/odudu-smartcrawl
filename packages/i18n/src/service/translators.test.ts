import { describe, expect, it } from 'vitest';
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
