import { describe, expect, it } from 'vitest';
import { etagOf, hasPrecondition, matches, requiredPrecondition } from '#/service/etag';

describe('etagOf', () => {
  it('is stable for equal records and differs for different ones', () => {
    expect(etagOf({ a: 1, b: 2 })).toBe(etagOf({ b: 2, a: 1 }));
    expect(etagOf({ a: 1 })).not.toBe(etagOf({ a: 2 }));
  });

  it('accounts for a record holding a literal __proto__ key', () => {
    // A literal `__proto__` key in an object assigns the prototype rather
    // than an own property, so a naive `sorted[key] = ...` canonicalising
    // this record silently drops the key — and a resource whose JSON body
    // carries `__proto__` as real data would canonicalise identically
    // with or without it, handing out a stale ETag.
    const withKey = JSON.parse('{"__proto__": {"evil": true}, "a": 1}') as Record<string, unknown>;
    const withoutKey = { a: 1 };
    expect(etagOf(withKey)).not.toBe(etagOf(withoutKey));
  });
});

describe('matches', () => {
  it('treats an absent header as a caller who did not ask', () => {
    expect(matches(undefined, '"abc"')).toBe('absent');
  });
  it('matches an equal tag and refuses an unequal one', () => {
    expect(matches('"abc"', '"abc"')).toBe('match');
    expect(matches('"stale"', '"abc"')).toBe('mismatch');
  });
  it('treats a wildcard as a match, per RFC 9110 §13.1.1', () => {
    // `*` means "if the resource exists" — already true by the time
    // `current` is in hand, since it was read from the resource itself.
    expect(matches('*', '"abc"')).toBe('match');
  });
});

describe('a list of validators', () => {
  it('matches when any member equals the current tag', () => {
    expect(matches('"a", "abc", "b"', '"abc"')).toBe('match');
    expect(matches('"a","abc"', '"abc"')).toBe('match');
    expect(matches('"a", "b"', '"abc"')).toBe('mismatch');
  });
  it('never matches a weak validator, since If-Match compares strongly', () => {
    expect(matches('W/"abc"', '"abc"')).toBe('mismatch');
  });
  it('is a mismatch, so a required write answers 412, when the header holds nothing', () => {
    expect(matches('', '"abc"')).toBe('mismatch');
  });
});

describe('a write that must name the version it read', () => {
  it('is refused as required when the header is absent or only a wildcard', () => {
    expect(requiredPrecondition(undefined, '"abc"')).toBe('required');
    expect(requiredPrecondition('*', '"abc"')).toBe('required');
    expect(requiredPrecondition('"x", *', '"abc"')).toBe('required');
  });
  it('passes on a tag in the list, and fails on a stale one', () => {
    expect(requiredPrecondition('"x", "abc"', '"abc"')).toBe('ok');
    expect(requiredPrecondition('"stale"', '"abc"')).toBe('failed');
  });
  it('counts a wildcard as no precondition at all', () => {
    expect(hasPrecondition(undefined)).toBe(false);
    expect(hasPrecondition('*')).toBe(false);
    expect(hasPrecondition(' * ')).toBe(false);
    expect(hasPrecondition('"abc"')).toBe(true);
  });
});
