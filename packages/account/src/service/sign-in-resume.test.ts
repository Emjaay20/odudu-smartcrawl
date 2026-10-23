import { describe, expect, it } from 'vitest';
import { referenceToResume, resumablePath } from '#/service/sign-in-resume';

const AUTH =
  '/tenants/acme/protocol/openid-connect/auth?response_type=code&client_id=console&state=s&nonce=n';
const HELD = { sessionId: '0192f2a0-0000-7000-8000-000000000001', signInPath: AUTH };

describe('referenceToResume', () => {
  it('is the held sign-in when the form carried that very request', () => {
    expect(referenceToResume(HELD, AUTH)).toBe(HELD.sessionId);
  });

  it('is nothing when the browser holds no sign-in', () => {
    expect(referenceToResume(null, AUTH)).toBeNull();
  });

  it('is nothing when the page carried no request', () => {
    expect(referenceToResume(HELD, null)).toBeNull();
  });

  it('is nothing when the page carried another request than the one held, as two tabs do', () => {
    expect(referenceToResume(HELD, AUTH.replace('console', 'portal'))).toBeNull();
  });

  it('is nothing when the held request cannot be rebuilt faithfully', () => {
    expect(referenceToResume({ ...HELD, signInPath: null }, AUTH)).toBeNull();
  });
});

describe('resumablePath', () => {
  it('is the held request when the link names the sign-in this browser holds', () => {
    expect(resumablePath(HELD, HELD.sessionId)).toBe(AUTH);
  });

  it('is nothing for a link that names no sign-in, as an administrator link does', () => {
    expect(resumablePath(HELD, null)).toBeNull();
  });

  it('is nothing for a link that names another sign-in than the one this browser holds', () => {
    expect(resumablePath(HELD, '0192f2a0-0000-7000-8000-000000000002')).toBeNull();
  });

  it('is nothing when the browser holds none', () => {
    expect(resumablePath(null, HELD.sessionId)).toBeNull();
  });

  it('is nothing when the held request cannot be rebuilt faithfully', () => {
    expect(resumablePath({ ...HELD, signInPath: null }, HELD.sessionId)).toBeNull();
  });
});
