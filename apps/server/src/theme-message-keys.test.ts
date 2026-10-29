import { PAGE_KINDS, scanSlots, type PageKind } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import {
  isOverridableMessageKey,
  isThemeMessageKey,
  pageKindOwners,
  pageMessageCatalogue,
} from '#/theme-message-keys';

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

describe('isOverridableMessageKey', () => {
  it('accepts a key of any page catalogue', () => {
    expect(isOverridableMessageKey('login.title')).toBe(true);
    expect(isOverridableMessageKey('updatePassword.rule.maxLength')).toBe(true);
    expect(isOverridableMessageKey('verification.succeeded.title')).toBe(true);
  });

  it('refuses a key in none, and Object.prototype names', () => {
    expect(isOverridableMessageKey('login.nonesuch')).toBe(false);
    expect(isOverridableMessageKey('')).toBe(false);
    expect(isOverridableMessageKey('constructor')).toBe(false);
    expect(isOverridableMessageKey('__proto__')).toBe(false);
  });
});

describe('pageMessageCatalogue', () => {
  const sections = pageMessageCatalogue().sections;

  it('lists, for each page kind, exactly the keys a template of it may name', () => {
    for (const kind of KINDS) {
      const section = sections.find((entry) => entry.kinds.includes(kind));
      expect(section, kind).toBeDefined();
      const listed = new Set(section?.messages.map((message) => message.key));
      expect(listed.size, kind).toBeGreaterThan(0);
      for (const key of listed) expect(isThemeMessageKey(kind, key), `${kind} ${key}`).toBe(true);
      for (const other of sections) {
        if (other === section) continue;
        for (const message of other.messages) {
          if (!listed.has(message.key)) expect(isThemeMessageKey(kind, message.key)).toBe(false);
        }
      }
    }
  });

  it('puts every page kind in one section and no section twice', () => {
    const seen = sections.flatMap((section) => section.kinds);
    expect([...seen].sort()).toEqual([...KINDS].sort());
  });

  it('lists only keys an override accepts, each once per section and in key order', () => {
    for (const section of sections) {
      const keys = section.messages.map((message) => message.key);
      expect(keys).toEqual([...keys].sort());
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(isOverridableMessageKey(key), key).toBe(true);
    }
  });

  it('lists only keys a template can write as {{t "key"}}, so a pick is never malformed', () => {
    for (const section of sections) {
      for (const { key } of section.messages) {
        expect(scanSlots(`{{t "${key}"}}`), key).toEqual([
          { kind: 'text', name: key, index: 0, end: key.length + 8 },
        ]);
      }
    }
  });

  it('carries the English text, never empty, and is a few hundred small entries', () => {
    const all = sections.flatMap((section) => section.messages);
    for (const message of all) expect(message.en.length, message.key).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(100);
    expect(all.length).toBeLessThan(1000);
    expect(JSON.stringify(sections).length).toBeLessThan(200_000);
  });
});
