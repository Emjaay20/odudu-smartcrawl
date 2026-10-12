import { describe, expect, it } from 'vitest';
import { disableConsequence, disablesTenant } from '#/features/settings/service/general';

describe('disablesTenant', () => {
  it('is true only when an enabled tenant is being switched off', () => {
    expect(disablesTenant(true, false)).toBe(true);
    expect(disablesTenant(false, false)).toBe(false);
    expect(disablesTenant(true, true)).toBe(false);
    expect(disablesTenant(false, true)).toBe(false);
  });
});

describe('disableConsequence', () => {
  it('says what the administrator doing it loses, and how to undo it', () => {
    const text = disableConsequence('acme');
    expect(text).toMatch(/Nobody can sign in to acme/u);
    expect(text).toMatch(/including you/u);
    expect(text).toMatch(/system administrator/u);
  });
});
