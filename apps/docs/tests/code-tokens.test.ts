import { readFileSync } from 'node:fs';
import path from 'node:path';
import { themes } from 'prism-react-renderer';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import codeTokens, { themeCss, tokenize, TOKENS_ATTRIBUTE } from '#docs/plugins/code-tokens.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

describe('the build-time highlighter', () => {
  it('splits a JSON block into lines of plain and classed pieces', () => {
    expect(tokenize('{\n  "a": 1\n}', 'json')).toEqual([
      [['punctuation', '{']],
      ['  ', ['property', '"a"'], ['operator', ':'], ' ', ['number', '1']],
      [['punctuation', '}']],
    ]);
  });

  it('writes nothing for a language it has no grammar for', () => {
    expect(tokenize('echo hi', 'bash')).toBeUndefined();
    expect(tokenize('echo hi', null)).toBeUndefined();
  });

  it('keeps every character of the code, lines and blanks included', () => {
    const code = 'select 1;\n\nselect 2;';
    const lines = tokenize(code, 'sql') ?? [];
    const text = lines.map((line) => line.map((p) => (typeof p === 'string' ? p : p[1])).join(''));
    expect(text.join('\n')).toBe(code);
  });

  it('attaches the lines to a fenced block as an attribute, and leaves other blocks alone', () => {
    const json = { type: 'code', lang: 'json', value: '[1]' };
    const shell = { type: 'code', lang: 'sh', value: 'ls' };
    codeTokens()({ type: 'root', children: [json, { type: 'paragraph', children: [shell] }] });
    expect(
      JSON.parse(
        String(
          (json as { data?: { hProperties?: Record<string, unknown> } }).data?.hProperties?.[
            TOKENS_ATTRIBUTE
          ],
        ),
      ),
    ).toEqual([
      [
        ['punctuation', '['],
        ['number', '1'],
        ['punctuation', ']'],
      ],
    ]);
    expect((shell as { data?: unknown }).data).toBeUndefined();
  });
});

describe('the colours of the code blocks', () => {
  it('are the two Prism themes, as classes, in the committed stylesheet', async () => {
    const file = path.join(DOCS_ROOT, 'src/css/code-tokens.css');
    const options = await prettier.resolveConfig(file);
    const expected = await prettier.format(themeCss(themes.github, themes.dracula), {
      ...options,
      parser: 'css',
    });
    expect(readFileSync(file, 'utf8')).toBe(expected);
  });
});
