import { describe, expect, it } from 'vitest';
import { loginBudgetKey } from '#/login-throttle';

const ORIGIN = '198.51.100.7';

describe('loginBudgetKey', () => {
  it('is injective in the origin, the tenant and the username', () => {
    const one = loginBudgetKey(ORIGIN, 't|a', { username: 'b' });
    const other = loginBudgetKey(ORIGIN, 't', { username: 'a|b' });

    expect(one).toBeDefined();
    expect(one).not.toBe(other);
    expect(loginBudgetKey('a|b', 'c', { username: 'd' })).not.toBe(
      loginBudgetKey('a', 'b|c', { username: 'd' }),
    );
  });

  it('folds case, padding and compatibility forms to one key', () => {
    const key = loginBudgetKey(ORIGIN, 'acme', { username: 'ada' });

    expect(loginBudgetKey(ORIGIN, 'acme', { username: '  ADA ' })).toBe(key);
    expect(loginBudgetKey(ORIGIN, 'acme', { username: 'ａｄａ' })).toBe(key);
  });

  it('has no key for a submission that names no username the route would read', () => {
    expect(loginBudgetKey(ORIGIN, 'acme', {})).toBeUndefined();
    expect(loginBudgetKey(ORIGIN, 'acme', { username: '   ' })).toBeUndefined();
    expect(loginBudgetKey(ORIGIN, 'acme', { username: ['ada', 'bob'] })).toBeUndefined();
    expect(loginBudgetKey(ORIGIN, 'acme', null)).toBeUndefined();
  });

  it('bounds a key however long the username and tenant are', () => {
    const key = loginBudgetKey(ORIGIN, 't'.repeat(5000), { username: 'u'.repeat(5000) });

    expect(key?.length).toBeLessThan(400);
  });
});
