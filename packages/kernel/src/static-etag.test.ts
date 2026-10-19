import { describe, expect, it } from 'vitest';
import { etagMatches, staticEtag } from '#/static-etag';

describe('staticEtag', () => {
  it('is a strong validator that follows the content', () => {
    const one = staticEtag(Buffer.from('one'));
    expect(one).toMatch(/^"[A-Za-z0-9_-]{27}"$/u);
    expect(staticEtag(Buffer.from('one'))).toBe(one);
    expect(staticEtag(Buffer.from('two'))).not.toBe(one);
  });
});

describe('etagMatches', () => {
  const etag = '"abc"';

  it('matches the validator, a list holding it, a weak form of it and `*`', () => {
    expect(etagMatches('"abc"', etag)).toBe(true);
    expect(etagMatches('"x", "abc"', etag)).toBe(true);
    expect(etagMatches('W/"abc"', etag)).toBe(true);
    expect(etagMatches('*', etag)).toBe(true);
  });

  it('does not match another validator or no header', () => {
    expect(etagMatches('"other"', etag)).toBe(false);
    expect(etagMatches(undefined, etag)).toBe(false);
    expect(etagMatches('', etag)).toBe(false);
  });
});
