import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => {
  const draws = ['ZZAdaZZZ', 'ZZZZZZZZ'];
  return {
    randomBytes: () => ({ toString: () => draws.shift() ?? 'QQQQQQQQ' }),
  };
});

const { randomPassword, SEEDED_USERNAMES } =
  await import('../../apps/admin-console/e2e/password.js');

describe('randomPassword', () => {
  it('draws again when the password contains a username, whatever its case', () => {
    expect(randomPassword('P-', ['ada'])).toBe('P-ZZZZZZZZ');
  });

  it('keeps the prefix', () => {
    expect(randomPassword('Visual-', [])).toMatch(/^Visual-/u);
  });

  it('gives up after a bounded number of draws, naming the prefix', () => {
    expect(() => randomPassword('Stuck-', [''])).toThrow(/prefix "Stuck-"/u);
    expect(() => randomPassword('Ada-', ['ada'])).toThrow(/avoided/u);
  });

  it('covers every username of three to six letters that the global setup seeds', () => {
    const setup = readFileSync('apps/admin-console/e2e/global-setup.ts', 'utf8');
    const seeded = [...setup.matchAll(/username: '([a-z]{3,6})'/gu)].map((m) => m[1]);
    expect(seeded.length).toBeGreaterThan(40);
    const missing = seeded.filter(
      (name) => !(SEEDED_USERNAMES as readonly (string | undefined)[]).includes(name),
    );
    expect(missing).toEqual([]);
  });
});
