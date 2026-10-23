import { describe, expect, it } from 'vitest';
import { BIDI_REFUSED, BidiControlError, containsBidiControl, refuseBidiControls } from '#/bidi';
import { OduduError } from '#/errors';

describe('refuseBidiControls', () => {
  it('accepts plain text, right-to-left text, absent values and the marks', () => {
    expect(() => {
      refuseBidiControls('username', 'ada');
    }).not.toThrow();
    expect(() => {
      refuseBidiControls('username', 'مرحبا');
    }).not.toThrow();
    expect(() => {
      refuseBidiControls('username', 'שלום');
    }).not.toThrow();
    expect(() => {
      refuseBidiControls('username', 'س\u200Fل');
    }).not.toThrow();
    expect(() => {
      refuseBidiControls('name', null);
    }).not.toThrow();
    expect(() => {
      refuseBidiControls('name', undefined);
    }).not.toThrow();
  });

  it('throws a typed error naming the field and never the value', () => {
    let thrown: unknown;
    try {
      refuseBidiControls('given_name', 'evil\u202Efdp.exe');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BidiControlError);
    expect(thrown).toBeInstanceOf(OduduError);
    const refused = thrown as BidiControlError;
    expect(refused.code).toBe(BIDI_REFUSED);
    expect(refused.field).toBe('given_name');
    expect(refused.message).toContain('given_name');
    expect(refused.message).not.toContain('evil');
  });

  it('shares its predicate with the contracts', () => {
    expect(containsBidiControl('\u2066')).toBe(true);
  });
});
