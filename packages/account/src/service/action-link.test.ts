import { describe, expect, it } from 'vitest';
import { actionLink, mailedSignInPath } from '#/service/action-link';

const FULL =
  '/tenants/acme/protocol/openid-connect/auth?response_type=code&client_id=portal&redirect_uri=https%3A%2F%2Fapp.example%2Fcb&scope=openid+email&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=SECRET-STATE&nonce=SECRET-NONCE&prompt=login&max_age=0&ui_locales=fr&resource=https%3A%2F%2Fapi.example&claims=%7B%22id_token%22%3A%7B%22email%22%3Anull%7D%7D';

describe('mailedSignInPath', () => {
  it('keeps what a sign-in start needs and nothing a mailbox should hold', () => {
    const kept = new URL(mailedSignInPath(FULL) ?? '', 'https://x');
    expect(kept.pathname).toBe('/tenants/acme/protocol/openid-connect/auth');
    expect([...kept.searchParams.keys()]).toEqual([
      'response_type',
      'client_id',
      'redirect_uri',
      'scope',
      'code_challenge',
      'code_challenge_method',
      'ui_locales',
      'resource',
    ]);
    expect(kept.searchParams.get('redirect_uri')).toBe('https://app.example/cb');
    for (const dropped of ['SECRET-STATE', 'SECRET-NONCE', 'claims', 'prompt', 'max_age']) {
      expect(mailedSignInPath(FULL)).not.toContain(dropped);
    }
  });

  it('is null for nothing, and for a path with no query to keep', () => {
    expect(mailedSignInPath(null)).toBeNull();
    expect(mailedSignInPath(undefined)).toBeNull();
    expect(
      mailedSignInPath('/tenants/acme/protocol/openid-connect/auth?state=x&nonce=y'),
    ).toBeNull();
  });
});

describe('actionLink', () => {
  const BASE = 'https://idp.example.test';

  it('is the tenant path and the key, with the tenant as one path segment', () => {
    expect(actionLink(BASE, 'acme', 'k_1-2', null)).toBe(
      'https://idp.example.test/tenants/acme/login-actions/action-token?key=k_1-2',
    );
    expect(actionLink(BASE, 'a b/c', 'k', undefined)).toBe(
      'https://idp.example.test/tenants/a%20b%2Fc/login-actions/action-token?key=k',
    );
  });

  it('adds the reduced way back, encoded, after the key', () => {
    const link = actionLink(BASE, 'acme', 'k', FULL);
    const url = new URL(link);
    expect(url.searchParams.get('key')).toBe('k');
    expect(url.searchParams.get('return_to')).toBe(mailedSignInPath(FULL));
    expect(link.indexOf('key=')).toBeLessThan(link.indexOf('return_to='));
    expect(link).not.toContain('SECRET');
  });
});

describe('mailedSignInPath against smuggled parameters', () => {
  const AUTH = '/tenants/acme/protocol/openid-connect/auth?client_id=portal&code_challenge=c';
  const keys = (path: string | null): string[] => [
    ...new URL(path ?? '', 'https://x').searchParams.keys(),
  ];

  it('drops a name that only differs in case or is percent-encoded', () => {
    expect(keys(mailedSignInPath(`${AUTH}&State=a&NONCE=b&%73tate=c&n%6Fnce=d`))).toEqual([
      'client_id',
      'code_challenge',
    ]);
  });

  it('keeps the first of a repeated parameter and drops the rest', () => {
    const path = mailedSignInPath(`${AUTH}&client_id=other&scope=a&scope=b`) ?? '';
    const url = new URL(path, 'https://x');
    expect(url.searchParams.getAll('client_id')).toEqual(['portal']);
    expect(url.searchParams.getAll('scope')).toEqual(['a']);
  });

  it('keeps state, nonce and claims written inside a value as part of that one value', () => {
    const nested = encodeURIComponent('https://app.example/cb?state=SECRET&nonce=N&claims=%7B%7D');
    const path = mailedSignInPath(`${AUTH}&redirect_uri=${nested}&resource=${nested}`) ?? '';
    expect(keys(path).sort()).toEqual(['client_id', 'code_challenge', 'redirect_uri', 'resource']);
    const url = new URL(path, 'https://x');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example/cb?state=SECRET&nonce=N&claims=%7B%7D',
    );
    expect(url.searchParams.has('state')).toBe(false);
    expect(url.searchParams.has('claims')).toBe(false);
  });
});
