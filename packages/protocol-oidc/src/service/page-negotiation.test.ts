import { describe, expect, it } from 'vitest';
import { isApiPath, wantsHtmlPage } from '#/service/page-negotiation';

const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

describe('wantsHtmlPage', () => {
  it('serves a page to what a browser sends for a navigation', () => {
    expect(wantsHtmlPage('GET', '/nope', BROWSER)).toBe(true);
    expect(wantsHtmlPage('HEAD', '/nope', BROWSER)).toBe(true);
    expect(wantsHtmlPage('GET', '/nope', 'text/html')).toBe(true);
  });

  it('keeps a program on the problem document', () => {
    for (const accept of [
      undefined,
      '',
      '*/*',
      'application/json',
      'application/problem+json',
      'text/*',
      'application/json, text/html;q=0.5',
      'text/html;q=0',
      'application/json;q=1, text/html;q=0.9',
    ]) {
      expect(wantsHtmlPage('GET', '/nope', accept), String(accept)).toBe(false);
    }
  });

  it('serves a page when html is preferred over json or tied with it', () => {
    expect(wantsHtmlPage('GET', '/nope', 'application/json;q=0.5, text/html')).toBe(true);
    expect(wantsHtmlPage('GET', '/nope', 'text/html, application/json')).toBe(true);
  });

  it('answers a request that is not a navigation with the problem document', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(wantsHtmlPage(method, '/nope', BROWSER), method).toBe(false);
    }
  });

  it('reads Accept sent as anything but text as no preference', () => {
    expect(wantsHtmlPage('GET', '/nope', ['text/html'])).toBe(false);
    expect(wantsHtmlPage('GET', '/nope', 42)).toBe(false);
  });

  it('never serves a page under an API prefix', () => {
    for (const path of [
      '/admin',
      '/admin/tenants/demo/nope',
      '/ADMIN/x',
      '/%61dmin/x',
      '/console/api',
      '/console/api/nope',
      '/health',
      '/health/nope',
      '/healthz',
      '/.well-known/openid-configuration',
      '/tenants/demo/protocol/openid-connect/token',
      '/tenants/demo/protocol/openid-connect/nope?x=1',
      '/tenants/demo/.well-known/openid-configuration',
      '/tenants/demo/clients-registrations/openid-connect',
      '/tenants/demo/clients-registrations/openid-connect/abc',
      '/tenants/demo/protocol/openid-connect/token',
      '/tenants/demo/protocol/openid-connect/userinfo',
      '/tenants/demo/protocol/openid-connect/certs',
      '/tenants/demo/protocol/openid-connect/token/introspect',
      '/tenants/demo/protocol/openid-connect/revoke',
      '/tenants/demo/protocol/openid-connect/logout',
      '/tenants/demo/protocol/openid-connect/ext/par/request',
      '/tenants/demo/protocol/openid-connect/auth/device',
      '/tenants/demo/anything-else',
      '/TENANTS/demo/Clients-Registrations/x',
      '/instrument/nope.css',
    ]) {
      expect(wantsHtmlPage('GET', path, BROWSER), path).toBe(false);
    }
  });

  it('serves a page for any other unknown path, and for the browser flows under a tenant', () => {
    for (const path of [
      '/',
      '/nope',
      '/tenants',
      '/tenants/demo',
      '/tenants/demo/login-actions/nope',
      '/a/b?c=d',
    ]) {
      expect(wantsHtmlPage('GET', path, BROWSER), path).toBe(true);
    }
  });
});

describe('isApiPath', () => {
  it('does not take a lookalike for a prefix', () => {
    expect(isApiPath('/administrators')).toBe(false);
    expect(isApiPath('/console/apiary')).toBe(false);
    expect(isApiPath('/console/nope')).toBe(false);
    expect(isApiPath('/tenants/protocol')).toBe(false);
  });

  it('reads a malformed escape as it is rather than throwing', () => {
    expect(isApiPath('/%E0%A4%A')).toBe(false);
  });
});

describe('a header the negotiation reads is bounded before it is parsed', () => {
  it('gives no preference to an Accept longer than a browser sends', () => {
    const long = `text/html,${'application/x-padding;q=0.1,'.repeat(100)}`;
    expect(long.length).toBeGreaterThan(2048);
    expect(wantsHtmlPage('GET', '/nope', long)).toBe(false);
  });

  it('reads a 64 KB hostile Accept in well under a millisecond budget', () => {
    const hostile = `${';'.repeat(65_536)}text/html`;
    const wide = `${'a/b;q=,'.repeat(9363)}text/html`;
    const started = performance.now();
    for (const accept of [hostile, wide]) {
      for (let i = 0; i < 100; i += 1) wantsHtmlPage('GET', '/nope', accept);
    }
    expect((performance.now() - started) / 200).toBeLessThan(1);
  });

  it('keeps a long path linear too', () => {
    const path = `/${'%2e'.repeat(5000)}x`;
    const started = performance.now();
    for (let i = 0; i < 100; i += 1) wantsHtmlPage('GET', path, 'text/html');
    expect((performance.now() - started) / 100).toBeLessThan(1);
  });
});

describe('under a tenant only the browser flows are page territory', () => {
  it('serves a page under login-actions and nowhere else beneath the tenant', () => {
    expect(wantsHtmlPage('GET', '/tenants/demo/login-actions/nope', BROWSER)).toBe(true);
    expect(wantsHtmlPage('GET', '/tenants/demo/login-actions', BROWSER)).toBe(true);
    expect(wantsHtmlPage('GET', '/tenants/demo/nope', BROWSER)).toBe(false);
  });
});

describe('a quality is read by the RFC 9110 grammar only', () => {
  const html = (q: string): string => `application/json;q=0.5, text/html;q=${q}`;

  it('accepts 0, up to three decimals below 1, and 1 with up to three zeros', () => {
    for (const q of ['1', '1.0', '1.00', '1.000', '0.9', '0.75', '0.501']) {
      expect(wantsHtmlPage('GET', '/nope', html(q)), q).toBe(true);
    }
    expect(wantsHtmlPage('GET', '/nope', html('0.4'))).toBe(false);
    expect(wantsHtmlPage('GET', '/nope', html('0'))).toBe(false);
  });

  it('ignores an entry whose quality is malformed, as if it were not sent', () => {
    for (const q of ['0x1', '1e3', 'Infinity', '2', '1.5', '1.0001', '0.1234', '', '-1', ' 1 1']) {
      expect(wantsHtmlPage('GET', '/nope', html(q)), JSON.stringify(q)).toBe(false);
    }
    // The malformed JSON entry does not outrank html either.
    expect(wantsHtmlPage('GET', '/nope', 'application/json;q=1e3, text/html;q=0.1')).toBe(true);
  });
});
