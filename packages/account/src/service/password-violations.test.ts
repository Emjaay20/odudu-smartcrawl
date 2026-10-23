import { describe, expect, it } from 'vitest';
import { withMinimum } from '#/service/password-violations';

describe('withMinimum', () => {
  it('adds the minimum to the minimum-length rule only', () => {
    expect(
      withMinimum(
        [
          { rule: 'min-length', message: 'a' },
          { rule: 'require-digit', message: 'b' },
        ],
        12,
      ),
    ).toEqual([
      { rule: 'min-length', message: 'a', minLength: 12 },
      { rule: 'require-digit', message: 'b' },
    ]);
  });

  it('leaves an empty report empty', () => {
    expect(withMinimum([], 8)).toEqual([]);
  });
});
