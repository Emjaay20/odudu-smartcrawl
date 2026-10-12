import { describe, expect, it } from 'vitest';
import { normalizeDisplayName } from '#/service/display-name';

describe('normalizeDisplayName', () => {
  it('trims a name, and reads a blank or absent one as none', () => {
    expect(normalizeDisplayName('  Acme Inc ')).toBe('Acme Inc');
    expect(normalizeDisplayName('')).toBeNull();
    expect(normalizeDisplayName(' \t ')).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
    expect(normalizeDisplayName(undefined)).toBeNull();
  });
});
