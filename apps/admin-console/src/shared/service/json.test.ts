import { describe, expect, it } from 'vitest';
import { parseJson } from '#/shared/service/json';

describe('parseJson', () => {
  it('returns the parsed value', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns undefined for text that is not JSON', () => {
    expect(parseJson('<html>')).toBeUndefined();
    expect(parseJson('')).toBeUndefined();
  });
});
