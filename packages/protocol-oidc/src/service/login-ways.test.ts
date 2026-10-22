import { describe, expect, it } from 'vitest';
import { loginWays } from '#/service/login-ways';

const SIGN_IN = '/tenants/acme/protocol/openid-connect/auth?response_type=code&client_id=portal';
const BOTH = { registrationAllowed: true, resetPasswordAllowed: true };
const NEITHER = { registrationAllowed: false, resetPasswordAllowed: false };

describe('loginWays', () => {
  it('offers nothing a tenant has not turned on', () => {
    expect(loginWays('acme', NEITHER, SIGN_IN)).toEqual({});
  });

  it('offers each page on its own setting', () => {
    expect(loginWays('acme', { ...NEITHER, registrationAllowed: true }, null)).toEqual({
      createAccount: '/tenants/acme/login-actions/registration',
    });
    expect(loginWays('acme', { ...NEITHER, resetPasswordAllowed: true }, null)).toEqual({
      resetPassword: '/tenants/acme/login-actions/reset-password',
    });
  });

  it('carries the way back to the sign-in as a parameter, encoded', () => {
    const ways = loginWays('acme', BOTH, SIGN_IN);
    const encoded = encodeURIComponent(SIGN_IN);
    expect(ways.createAccount).toBe(
      `/tenants/acme/login-actions/registration?return_to=${encoded}`,
    );
    expect(ways.resetPassword).toBe(
      `/tenants/acme/login-actions/reset-password?return_to=${encoded}`,
    );
  });

  it('encodes a tenant name that needs it, so the path stays on this tenant', () => {
    expect(loginWays('a/b c', BOTH, null).createAccount).toBe(
      '/tenants/a%2Fb%20c/login-actions/registration',
    );
  });
});
