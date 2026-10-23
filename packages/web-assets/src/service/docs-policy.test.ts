import { describe, expect, it } from 'vitest';
import { docsPolicy, parseDocsCsp } from '#/service/docs-policy';

const SCRIPT = `sha256-${'A'.repeat(43)}=`;
const STYLE = `sha256-${'b'.repeat(43)}=`;
const OTHER = `sha256-${'C'.repeat(43)}=`;

describe('docsPolicy', () => {
  it('is the fixed policy with the build hashes in two directives', () => {
    expect(docsPolicy({ scriptHashes: [SCRIPT], styleAttributeHashes: [STYLE] })).toBe(
      `default-src 'self'; script-src 'self' '${SCRIPT}'; style-src 'self'; ` +
        `style-src-attr 'unsafe-hashes' '${STYLE}'; img-src 'self' data:; font-src 'self'; ` +
        "connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
    );
  });

  it('lists every hash of a set, in the order given', () => {
    const policy = docsPolicy({ scriptHashes: [SCRIPT, OTHER], styleAttributeHashes: [STYLE] });
    expect(policy).toContain(`script-src 'self' '${SCRIPT}' '${OTHER}';`);
  });

  it('never licenses inline code or eval', () => {
    const policy = docsPolicy({ scriptHashes: [SCRIPT], styleAttributeHashes: [STYLE] });
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('names no hash when the build has none, rather than an empty source list', () => {
    const policy = docsPolicy({ scriptHashes: [], styleAttributeHashes: [] });
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("style-src-attr 'none';");
  });

  it.each([
    ['no sha256- prefix', 'A'.repeat(44)],
    ['a short digest', `sha256-${'A'.repeat(42)}=`],
    ['a long digest', `sha256-${'A'.repeat(44)}=`],
    ['sha512', `sha512-${'A'.repeat(86)}==`],
    ['a quote that closes the source', `sha256-${'A'.repeat(43)}='`],
    ['a semicolon that opens a directive', `sha256-${'A'.repeat(43)};`],
    ['a space that adds a source', `sha256-${'A'.repeat(42)} =`],
    ['url-safe base64', `sha256-${'-'.repeat(43)}=`],
  ])('refuses a hash with %s', (_why, hash) => {
    expect(() => docsPolicy({ scriptHashes: [hash], styleAttributeHashes: [] })).toThrow(/hash/u);
    expect(() => docsPolicy({ scriptHashes: [], styleAttributeHashes: [hash] })).toThrow(/hash/u);
  });
});

describe('parseDocsCsp', () => {
  it('reads the two lists of hashes the build writes', () => {
    expect(parseDocsCsp({ scriptHashes: [SCRIPT], styleAttributeHashes: [STYLE] })).toEqual({
      scriptHashes: [SCRIPT],
      styleAttributeHashes: [STYLE],
    });
  });

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['an array', []],
    ['no style list', { scriptHashes: [SCRIPT] }],
    ['a script list that is not a list', { scriptHashes: SCRIPT, styleAttributeHashes: [] }],
    ['a hash that is not a string', { scriptHashes: [1], styleAttributeHashes: [] }],
    ['a malformed hash', { scriptHashes: [], styleAttributeHashes: ['sha256-x'] }],
  ])('refuses %s', (_why, value) => {
    expect(() => parseDocsCsp(value)).toThrow();
  });
});
