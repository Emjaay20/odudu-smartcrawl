import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS } from '#/service/common-passwords-data';
import { COMMON_PASSWORD_COUNT, isCommonPassword } from '#/service/common-password';

describe('isCommonPassword', () => {
  const context = ['acme', 'ada', 'grace'];

  it('refuses an entry of the bundled list', () => {
    expect(isCommonPassword('password', context)).toBe(true);
    expect(isCommonPassword('12345678', context)).toBe(true);
  });

  it('compares without regard to case', () => {
    expect(isCommonPassword('PassWord', context)).toBe(true);
  });

  it('compares after Unicode normalisation', () => {
    // Fullwidth letters fold to ASCII under NFKC.
    expect(isCommonPassword('ｐａｓｓｗｏｒｄ', context)).toBe(true);
  });

  it('refuses only the whole password, not one that contains an entry', () => {
    expect(isCommonPassword('password and a horse battery', context)).toBe(false);
    expect(isCommonPassword('my-12345678-staple', context)).toBe(false);
  });

  it('refuses a context word on its own, whatever its case', () => {
    expect(isCommonPassword('ACME', context)).toBe(true);
    expect(isCommonPassword('Grace', context)).toBe(true);
  });

  it('ignores an empty context word', () => {
    expect(isCommonPassword('', [''])).toBe(false);
  });

  it('always treats the product name as a context word', () => {
    expect(isCommonPassword('Odudu', [])).toBe(true);
  });

  it('accepts a password that is not listed', () => {
    expect(isCommonPassword('correct horse battery staple', context)).toBe(false);
  });

  it('holds a bounded list of lowercase entries, each at least eight characters', () => {
    const entries = COMMON_PASSWORDS.split('\n').filter((line) => line !== '');
    expect(COMMON_PASSWORD_COUNT).toBe(new Set(entries).size);
    expect(COMMON_PASSWORD_COUNT).toBeGreaterThan(10_000);
    expect(COMMON_PASSWORD_COUNT).toBeLessThanOrEqual(100_000);
    expect(entries.every((entry) => entry === entry.toLowerCase())).toBe(true);
    expect(entries.every((entry) => Array.from(entry).length >= 8)).toBe(true);
  });
});
