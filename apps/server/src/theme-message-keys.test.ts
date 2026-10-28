import { PAGE_KINDS, type PageKind } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { isThemeMessageKey, pageKindOwners } from '#/theme-message-keys';

const KINDS = Object.keys(PAGE_KINDS) as PageKind[];

describe('isThemeMessageKey', () => {
  it('has exactly one package fill every page kind', () => {
    for (const kind of KINDS) expect(pageKindOwners(kind), kind).toBe(1);
  });

  it('accepts a key of the package that fills the kind and no other package’s', () => {
    expect(isThemeMessageKey('sign-in', 'login.title')).toBe(true);
    expect(isThemeMessageKey('totp-enrolment', 'login.title')).toBe(false);
  });

  it('refuses a key that is in no catalogue, and Object.prototype names', () => {
    expect(isThemeMessageKey('sign-in', 'login.nonesuch')).toBe(false);
    expect(isThemeMessageKey('sign-in', 'constructor')).toBe(false);
    expect(isThemeMessageKey('sign-in', '__proto__')).toBe(false);
  });
});
