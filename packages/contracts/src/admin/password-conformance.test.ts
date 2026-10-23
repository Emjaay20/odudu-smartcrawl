import { describe, expect, it } from 'vitest';
import {
  PASSWORD_ALONE_MIN_LENGTH,
  PASSWORD_WITH_SECOND_FACTOR_MIN_LENGTH,
  passwordConformance,
} from '#/admin/password-conformance';

describe('passwordConformance', () => {
  it.each([
    [15, false, 'conforms'],
    [64, false, 'conforms'],
    [14, false, 'needs_second_factor'],
    [8, false, 'needs_second_factor'],
    [8, true, 'conforms_with_second_factor'],
    [14, true, 'conforms_with_second_factor'],
    [15, true, 'conforms'],
    [256, true, 'conforms'],
  ] as const)('a minimum of %i with a second factor required %s is %s', (min, required, state) => {
    expect(passwordConformance(min, required)).toBe(state);
  });

  it('names the two thresholds', () => {
    expect(PASSWORD_ALONE_MIN_LENGTH).toBe(15);
    expect(PASSWORD_WITH_SECOND_FACTOR_MIN_LENGTH).toBe(8);
  });

  it('judges a minimum below the second-factor floor as not conforming', () => {
    expect(passwordConformance(7, true)).toBe('needs_second_factor');
  });
});
