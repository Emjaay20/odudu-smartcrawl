import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => {
  const draws = ['ZZAdaZZZ', 'ZZZZZZZZ'];
  return {
    randomBytes: () => ({ toString: () => draws.shift() ?? 'QQQQQQQQ' }),
  };
});

const { randomPassword } = await import('../../apps/admin-console/e2e/password.js');

describe('randomPassword', () => {
  it('draws again when the password contains a username, whatever its case', () => {
    expect(randomPassword('P-', ['ada'])).toBe('P-ZZZZZZZZ');
  });

  it('keeps the prefix', () => {
    expect(randomPassword('Visual-', [])).toMatch(/^Visual-/u);
  });
});
