import { describe, expect, it } from 'vitest';
import { actionLink } from '#/service/action-link';

describe('actionLink', () => {
  const BASE = 'https://idp.example.test';

  it('is the tenant path and the key, with the tenant as one path segment', () => {
    expect(actionLink(BASE, 'acme', 'k_1-2')).toBe(
      'https://idp.example.test/tenants/acme/login-actions/action-token?key=k_1-2',
    );
    expect(actionLink(BASE, 'a b/c', 'k')).toBe(
      'https://idp.example.test/tenants/a%20b%2Fc/login-actions/action-token?key=k',
    );
  });

  it('carries nothing of the request the person was signing in to', () => {
    const url = new URL(actionLink(BASE, 'acme', 'k'));
    expect([...url.searchParams.keys()]).toEqual(['key']);
  });
});
