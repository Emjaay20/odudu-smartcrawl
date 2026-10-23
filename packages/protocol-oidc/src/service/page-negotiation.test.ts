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

  // Linear work grows eightfold when the input does; backtracking grows far
  // faster (quadratic is 64x). The best of several runs of each size, and a
  // bound at three times the linear ratio, make this a statement about growth
  // that a loaded runner cannot turn into a failure.
  function growth(read: (size: number) => void, small: number, large: number): number {
    const best = (size: number): number => {
      let fastest = Infinity;
      for (let run = 0; run < 7; run += 1) {
        const started = performance.now();
        for (let i = 0; i < 20; i += 1) read(size);
        fastest = Math.min(fastest, performance.now() - started);
      }
      return fastest;
    };
    read(small);
    read(large);
    return best(large) / Math.max(best(small), 0.01);
  }
  const LINEAR_BOUND = 24;

  it('reads a hostile Accept in time that grows with its length, not faster', () => {
    const semicolons = (size: number): void => {
      wantsHtmlPage('GET', '/nope', `${';'.repeat(size)}text/html`);
    };
    const pairs = (size: number): void => {
      wantsHtmlPage('GET', '/nope', `${'a/b;q=,'.repeat(size / 7)}text/html`);
    };
    expect(growth(semicolons, 8192, 65_536)).toBeLessThan(LINEAR_BOUND);
    expect(growth(pairs, 8190, 65_534)).toBeLessThan(LINEAR_BOUND);
  });

  it('keeps a long path linear too', () => {
    const path = (size: number): void => {
      wantsHtmlPage('GET', `/${'%2e'.repeat(size)}x`, 'text/html');
    };
    expect(growth(path, 1000, 8000)).toBeLessThan(LINEAR_BOUND);
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
