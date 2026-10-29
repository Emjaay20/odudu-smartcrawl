import { describe, expect, it } from 'vitest';
import { cssTokens } from '#/shared/service/code/css';
import { HIGHLIGHT_LIMIT, type CodeToken } from '#/shared/service/code/tokens';
import { highlight, normalisedBreaks } from '#/shared/service/code';

function joined(tokens: readonly CodeToken[]): string {
  return tokens.map((token) => token.text).join('');
}

function of(tokens: readonly CodeToken[], kind: CodeToken['kind']): string[] {
  return tokens.filter((token) => token.kind === kind).map((token) => token.text);
}

describe('cssTokens', () => {
  it('colours a rule: selector, property, values', () => {
    const source = '.hook-card {\n  color: #0a6344;\n  margin: 0 1.5rem;\n}';
    const tokens = cssTokens(source);
    expect(joined(tokens)).toBe(source);
    expect(of(tokens, 'selector')).toEqual(['.hook-card ']);
    expect(of(tokens, 'property')).toEqual(['color', 'margin']);
    expect(of(tokens, 'number')).toEqual(['#0a6344', '0', '1.5rem']);
  });

  it('reads comments, strings and url() whatever they hold', () => {
    const source = 'a { background: url(data.png) url("x;}") /* ; { */ ; content: "}" }';
    const tokens = cssTokens(source);
    expect(joined(tokens)).toBe(source);
    expect(of(tokens, 'comment')).toEqual(['/* ; { */']);
    expect(of(tokens, 'string')).toEqual(['data.png', '"x;}"', '"}"']);
    expect(of(tokens, 'function')).toEqual(['url', 'url']);
  });

  it('reads at-rules and a media block of rules', () => {
    const source = '@media (min-width: 40rem) {\n  .a { color: red !important }\n}';
    const tokens = cssTokens(source);
    expect(joined(tokens)).toBe(source);
    expect(of(tokens, 'keyword')).toEqual(['@media', '!important']);
    expect(of(tokens, 'selector')).toEqual(['.a ']);
    expect(of(tokens, 'property')).toContain('color');
    expect(of(tokens, 'number')).toContain('40rem');
  });

  it('reads a property inside a block of declarations after an at-rule', () => {
    const tokens = cssTokens('@font-face { src: url(x) }');
    expect(of(tokens, 'property')).toEqual(['src']);
  });

  it('reads a negative number, a custom property and a function', () => {
    const tokens = cssTokens('a { --gap: calc(-1px + var(--x)); margin: -.5em }');
    expect(of(tokens, 'property')).toEqual(['--gap', 'margin']);
    expect(of(tokens, 'function')).toEqual(['calc', 'var']);
    expect(of(tokens, 'number')).toEqual(['-1px', '-.5em']);
  });

  it('colours an attribute selector string', () => {
    const tokens = cssTokens('a[href="x"] { color: red }');
    expect(of(tokens, 'string')).toEqual(['"x"']);
  });

  it('is empty for nothing', () => {
    expect(cssTokens('')).toEqual([]);
  });

  describe('text that is broken', () => {
    it.each([
      ['an unterminated string', 'a { content: "abc\n  color: red }'],
      ['an unterminated comment', 'a { color: red } /* never closed'],
      ['an unterminated url', 'a { background: url(abc'],
      ['a lone brace', '}}}{{{'],
      ['a dangling at-rule', '@media'],
      ['a backslash at the end', 'a { content: "\\'],
      ['a quote alone', '"'],
      ['stray punctuation', ':;{}()!#@/*'],
    ])('keeps every character of %s', (_name, source) => {
      const tokens = cssTokens(source);
      expect(joined(tokens)).toBe(source);
      expect(tokens.every((token) => token.text !== '')).toBe(true);
    });

    it('ends a string at its line', () => {
      const tokens = cssTokens('a { content: "abc\n  color: red }');
      expect(of(tokens, 'string')).toEqual(['"abc']);
      expect(of(tokens, 'value')).toContain('color');
    });

    it('runs an unterminated comment to the end', () => {
      expect(of(cssTokens('a { } /* x\ny'), 'comment')).toEqual(['/* x\ny']);
    });
  });

  describe('size', () => {
    it('reads a very long single line in one pass and keeps it whole', () => {
      const source = `a { color: ${'red '.repeat(9000)}}`;
      const started = performance.now();
      const tokens = cssTokens(source);
      expect(performance.now() - started).toBeLessThan(500);
      expect(joined(tokens)).toBe(source);
    });

    it('does not cost more than linear for unclosed openers', () => {
      const small = '"'.repeat(10_000);
      const large = '"'.repeat(40_000);
      const time = (text: string): number => {
        const started = performance.now();
        cssTokens(text);
        return performance.now() - started;
      };
      time(small);
      expect(time(large)).toBeLessThan(500);
    });

    it('handles deep nesting of braces', () => {
      const source = '{'.repeat(30_000);
      expect(joined(cssTokens(source))).toBe(source);
    });
  });
});

describe('highlight', () => {
  it('reads \\r\\n and \\r as one line break each, as a textarea does', () => {
    const result = highlight('css', 'a {\r\n  color: red;\r}\r\n');
    expect(joined(result.tokens)).toBe('a {\n  color: red;\n}\n');
    expect(normalisedBreaks('x\r\ny\rz')).toBe('x\ny\nz');
  });

  it('degrades to the text as typed beyond the limit', () => {
    const source = `a { color: red }\n${'x'.repeat(HIGHLIGHT_LIMIT)}`;
    const result = highlight('css', source);
    expect(result.plain).toBe(true);
    expect(result.tokens).toEqual([{ kind: 'plain', text: source }]);
  });

  it('colours at the limit', () => {
    const source = `${'/'.repeat(0)}${' '.repeat(HIGHLIGHT_LIMIT)}`;
    expect(highlight('css', source).plain).toBe(false);
  });

  it('has no tokens for no text', () => {
    expect(highlight('css', '').tokens).toEqual([]);
    expect(highlight('template', '').tokens).toEqual([]);
  });
});
