import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  it('covers every username of three to six letters that the specs seed', () => {
    const dir = fileURLToPath(new URL('../../apps/admin-console/e2e', import.meta.url));
    const files = readdirSync(dir).filter((f) => f === 'global-setup.ts' || f.endsWith('.spec.ts'));
    const seeded = files.flatMap((file) => {
      const text = readFileSync(`${dir}/${file}`, 'utf8');
      const found = [
        ...text.matchAll(/username: '([a-z]{3,6})'/gu),
        ...text.matchAll(/'--username',\s*'([a-z]{3,6})'/gu),
      ];
      return found.map((m) => m[1]);
    });
    expect(seeded.length).toBeGreaterThan(48);
    const known: readonly (string | undefined)[] = SEEDED_USERNAMES;
    expect(seeded.filter((name) => !known.includes(name))).toEqual([]);
  });
});
