import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_STYLESHEET,
  brandingHead,
  brandingProblems,
  pageHeaders,
  reloadOnRestore,
  withBranding,
  type ResolvedBranding,
} from '#/page';

const headerMap = (page: Parameters<typeof pageHeaders>[0]): Record<string, string> =>
  Object.fromEntries(pageHeaders(page).map(([name, value]) => [name, value]));

const MARKUP_ONLY_PAGE = {
  html: '<!doctype html>',
  body: '<!doctype html>',
  title: 'Untitled',
  script: null,
  frames: [],
  locale: { tag: 'en', dir: 'ltr' as const },
};

describe('the headers every rendered page carries', () => {
  it('describes a markup-only page as needing nothing', () => {
    const csp = headerMap(MARKUP_ONLY_PAGE)['content-security-policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('script-src');
  });

  it('licenses a same-origin stylesheet, font and image on every page', () => {
    const csp = headerMap(MARKUP_ONLY_PAGE)['content-security-policy'] ?? '';
    const directives = csp.split('; ');
    expect(directives).toContain("style-src 'self'");
    expect(directives).toContain("font-src 'self'");
    expect(directives).toContain("img-src 'self'");
    expect(directives).toContain("default-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('names the stylesheet the pages link', () => {
    expect(INSTRUMENT_STYLESHEET).toBe('/instrument/instrument.css');
  });

  it('sends exactly six headers, one of them forbidding a sniffed content type', () => {
    const headers = headerMap(MARKUP_ONLY_PAGE);
    expect(headers['content-security-policy']).toBe(
      [
        "default-src 'none'",
        "style-src 'self'",
        "font-src 'self'",
        "img-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'none'",
      ].join('; '),
    );
    expect(Object.keys(headers).sort()).toEqual([
      'cache-control',
      'content-language',
      'content-security-policy',
      'referrer-policy',
      'x-content-type-options',
      'x-frame-options',
    ]);
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['cache-control']).toBe('no-store');
  });

  it('sends Content-Language from the negotiated locale', () => {
    expect(headerMap(MARKUP_ONLY_PAGE)['content-language']).toBe('en');
    expect(
      headerMap({ ...MARKUP_ONLY_PAGE, locale: { tag: 'ar-EG', dir: 'rtl' } })['content-language'],
    ).toBe('ar-EG');
  });

  it('carries the framing defence and the referrer policy on every page', () => {
    const headers = headerMap(MARKUP_ONLY_PAGE);
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  it('forbids every cache from storing a page', () => {
    expect(headerMap(MARKUP_ONLY_PAGE)['cache-control']).toBe('no-store');
    expect(
      headerMap({ ...MARKUP_ONLY_PAGE, script: { nonce: 'abc', fetchesSameOrigin: false } })[
        'cache-control'
      ],
    ).toBe('no-store');
  });

  // The nonce comes from the markup that used it, never from the caller:
  // a policy naming a nonce the page does not carry fails exactly as
  // silently as no policy at all (ADR 0018's amendment).
  it('derives script-src from the nonce the page reports', () => {
    const csp = headerMap({
      html: '<script nonce="abc">',
      body: '<script nonce="abc">',
      title: 'Untitled',
      script: { nonce: 'abc', fetchesSameOrigin: false },
      frames: [],
      locale: { tag: 'en', dir: 'ltr' as const },
    })['content-security-policy'];
    expect(csp).toContain("script-src 'nonce-abc'");
    expect(csp).not.toContain('connect-src');
  });

  it('licenses connect-src only for a script that actually fetches', () => {
    const csp = headerMap({
      html: '<script nonce="abc">',
      body: '<script nonce="abc">',
      title: 'Untitled',
      script: { nonce: 'abc', fetchesSameOrigin: true },
      frames: [],
      locale: { tag: 'en', dir: 'ltr' as const },
    })['content-security-policy'];
    expect(csp).toContain("connect-src 'self'");
  });

  it('names no frame-src for a page that frames nothing', () => {
    const csp = headerMap(MARKUP_ONLY_PAGE)['content-security-policy'];
    expect(csp).not.toContain('frame-src');
    expect(csp).toContain("default-src 'none'");
  });

  it('derives frame-src from the origins the page itself carries', () => {
    const csp = headerMap({
      ...MARKUP_ONLY_PAGE,
      frames: ['https://rp.example', 'https://other.example'],
    })['content-security-policy'];
    expect(csp).toContain('frame-src https://rp.example https://other.example');
  });

  it('keeps x-frame-options DENY for a page that frames others', () => {
    const headers = headerMap({ ...MARKUP_ONLY_PAGE, frames: ['https://rp.example'] });
    expect(headers['x-frame-options']).toBe('DENY');
  });

  // The origins come from a row per relying party, and two clients may
  // register logout URIs on one host.
  it('deduplicates repeated origins rather than repeating them in the policy', () => {
    const csp = headerMap({
      ...MARKUP_ONLY_PAGE,
      frames: ['https://rp.example', 'https://rp.example'],
    })['content-security-policy'];
    expect(csp).toContain('frame-src https://rp.example');
    expect(csp?.match(/rp\.example/gu)).toHaveLength(1);
  });

  // `new URL('https://a.test;script-src/x').origin` keeps the semicolon, so
  // an origin from a registered URI can open a directive of its own.
  it('names no origin that is not a plain host, so none can add a directive', () => {
    const csp = headerMap({
      ...MARKUP_ONLY_PAGE,
      frames: ['https://rp.example', 'https://a.test;sandbox', "https://a.test 'self'", 'null'],
    })['content-security-policy'];
    expect(csp).toContain('frame-src https://rp.example');
    expect(csp).not.toContain('sandbox');
    expect(csp?.split('; ').filter((directive) => directive.startsWith('frame-src'))).toEqual([
      'frame-src https://rp.example',
    ]);
  });

  it('names no frame-src when none of the origins is a plain host', () => {
    const csp = headerMap({ ...MARKUP_ONLY_PAGE, frames: ['https://a.test;sandbox'] })[
      'content-security-policy'
    ];
    expect(csp).not.toContain('frame-src');
  });
});

// Chromium applies form-action to every redirect a form submission follows,
// so a login form whose POST answers 302 to a relying party on another
// origin is refused there unless the policy names that origin.
describe('form-action on a page whose form may redirect to a client', () => {
  const formAction = (redirectsTo: string | undefined): string | undefined =>
    headerMap({ ...MARKUP_ONLY_PAGE, ...(redirectsTo === undefined ? {} : { redirectsTo }) })
      ['content-security-policy']?.split('; ')
      .find((directive) => directive.startsWith('form-action'));

  it("keeps 'self' alone for a page that names no client redirect", () => {
    expect(formAction(undefined)).toBe("form-action 'self'");
  });

  it('adds the origin of the redirect URI, never its path or query', () => {
    expect(formAction('https://rp.example:8443/callback?x=1')).toBe(
      "form-action 'self' https://rp.example:8443",
    );
    expect(formAction('http://localhost:8080/cb')).toBe("form-action 'self' http://localhost:8080");
  });

  it('names the scheme alone for a private-use URI scheme', () => {
    expect(formAction('com.example.app:/oauth2redirect')).toBe(
      "form-action 'self' com.example.app:",
    );
  });

  it('adds nothing for a value it cannot express as a source', () => {
    for (const value of [
      '',
      'not a uri',
      'https://a;b.example/',
      'javascript:alert(1)',
      'data:,x',
    ]) {
      expect(formAction(value)).toBe("form-action 'self'");
    }
    expect(formAction("https://rp.example/'none'")).toBe("form-action 'self' https://rp.example");
  });
});

// A page restored from the back/forward cache is the DOM it was left with,
// whatever its headers said, so a form bound to a session that has since
// expired comes back alive-looking. `pageshow` with `persisted` is the one
// signal a restore gives.
describe('reloading a form restored from the back/forward cache', () => {
  const PAGE = {
    html: '<!doctype html>\n<html><body>\n<form></form>\n</body></html>',
    body: '<form></form>',
    title: 'Sign in',
    script: null,
    frames: [],
    locale: { tag: 'en', dir: 'ltr' as const },
  };
  const SCRIPT_ELEMENT =
    /<script nonce="([^"]+)">[^<]*pageshow[^<]*persisted[^<]*reload\(\)[^<]*<\/script>/u;

  it('adds one script, in the document and in the body a theme is handed', () => {
    const page = reloadOnRestore(PAGE);
    expect(page.script).not.toBeNull();
    for (const markup of [page.html, page.body]) {
      expect(markup.match(/<script/gu)).toHaveLength(1);
      expect(SCRIPT_ELEMENT.exec(markup)?.[1]).toBe(page.script?.nonce);
    }
    expect(page.html.indexOf('<script')).toBeLessThan(page.html.indexOf('</body>'));
  });

  it('licenses exactly that nonce in the policy, and no request', () => {
    const page = reloadOnRestore(PAGE);
    const csp = headerMap(page)['content-security-policy'];
    expect(csp).toContain(`script-src 'nonce-${page.script?.nonce ?? ''}'`);
    expect(csp).not.toContain('connect-src');
  });

  it('shares the nonce of a script the page already carries', () => {
    const page = reloadOnRestore({
      ...PAGE,
      html: PAGE.html.replace('<form></form>', '<form></form><script nonce="abc">1</script>'),
      body: '<form></form><script nonce="abc">1</script>',
      script: { nonce: 'abc', fetchesSameOrigin: true },
    });
    expect(page.script).toEqual({ nonce: 'abc', fetchesSameOrigin: true });
    expect(page.body.match(/nonce="abc"/gu)).toHaveLength(2);
    expect(page.body.match(/nonce="/gu)).toHaveLength(2);
    expect(headerMap(page)['content-security-policy']).toContain("connect-src 'self'");
  });

  it('mints a different nonce for each page', () => {
    expect(reloadOnRestore(PAGE).script?.nonce).not.toBe(reloadOnRestore(PAGE).script?.nonce);
  });

  it('leaves the rest of the page as it was', () => {
    const page = reloadOnRestore(PAGE);
    expect(page.title).toBe('Sign in');
    expect(page.html.startsWith('<!doctype html>\n<html><body>\n<form></form>')).toBe(true);
    expect(page.html.endsWith('\n</body></html>')).toBe(true);
  });
});

// The script text itself, run against a stand-in window: no bfcache exists
// in the browsers CI drives, so the one decision it makes is held here.
describe('what the reload script does when run', () => {
  const PAGE = {
    html: '<html><body>\n</body></html>',
    body: '',
    title: 'Sign in',
    script: null,
    frames: [],
    locale: { tag: 'en', dir: 'ltr' as const },
  };

  function run(): { fire(persisted: boolean): void; reloads: () => number } {
    const text = /<script nonce="[^"]+">([^<]*)<\/script>/u.exec(reloadOnRestore(PAGE).body)?.[1];
    let handler: ((event: { persisted: boolean }) => void) | undefined;
    let reloads = 0;
    const events: string[] = [];
    const window = {
      addEventListener(type: string, listener: (event: { persisted: boolean }) => void) {
        events.push(type);
        handler = listener;
      },
    };
    const location = { reload: () => (reloads += 1) };
    runInNewContext(text ?? '', { window, location });
    expect(events).toEqual(['pageshow']);
    return {
      fire: (persisted) => handler?.({ persisted }),
      reloads: () => reloads,
    };
  }

  it('does nothing when it is loaded, so a reload cannot start another', () => {
    expect(run().reloads()).toBe(0);
  });

  it('reloads on a restore and not on an ordinary show', () => {
    const page = run();
    page.fire(false);
    expect(page.reloads()).toBe(0);
    page.fire(true);
    expect(page.reloads()).toBe(1);
  });
});

describe('the locale a page is sent under', () => {
  it('refuses a direction that is neither ltr nor rtl', () => {
    const page = { ...MARKUP_ONLY_PAGE, locale: { tag: 'en', dir: 'up' as never } };
    expect(() => pageHeaders(page)).toThrow();
  });

  it('refuses a tag that could break out of the header', () => {
    for (const tag of ['en\r\nX: y', 'en"><script>', '', 'x'.repeat(36)]) {
      expect(() => pageHeaders({ ...MARKUP_ONLY_PAGE, locale: { tag, dir: 'ltr' } })).toThrow();
    }
  });
});

const BASE = [
  "default-src 'none'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
];
const FIXED_HEADERS = [
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'no-referrer'],
  ['cache-control', 'no-store'],
  ['x-content-type-options', 'nosniff'],
  ['content-language', 'en'],
];
const withCsp = (directives: string[]): (readonly [string, string])[] => [
  ['content-security-policy', directives.join('; ')],
  ...(FIXED_HEADERS as [string, string][]),
];

const ORIGIN = 'https://idp.example';
const branding = (over: Partial<ResolvedBranding> = {}): ResolvedBranding => ({
  origin: ORIGIN,
  templates: {},
  tokensCss: ':root{--x:1}',
  stylesheetUrl: '/t/acme/theme/abc123.css',
  faviconUrl: '/t/acme/theme/fav456.png',
  logo: { url: '/t/acme/theme/logo789.png', darkUrl: null, alt: 'Acme' },
  assetUrls: ['/t/acme/theme/logo789.png'],
  ...over,
});
const themed = (b: ResolvedBranding | null, over = {}): Parameters<typeof pageHeaders>[0] => ({
  ...MARKUP_ONLY_PAGE,
  ...over,
  locale: withBranding(MARKUP_ONLY_PAGE.locale, b),
});

describe('a page without branding', () => {
  it("has today's headers exactly", () => {
    expect(pageHeaders(MARKUP_ONLY_PAGE)).toEqual(withCsp(BASE));
    expect(
      pageHeaders({ ...MARKUP_ONLY_PAGE, script: { nonce: 'abc', fetchesSameOrigin: true } }),
    ).toEqual(withCsp([...BASE, "script-src 'nonce-abc'", "connect-src 'self'"]));
    expect(pageHeaders({ ...MARKUP_ONLY_PAGE, frames: ['https://rp.example'] })).toEqual(
      withCsp([...BASE, 'frame-src https://rp.example']),
    );
    expect(pageHeaders({ ...MARKUP_ONLY_PAGE, redirectsTo: 'https://rp.example/cb' })).toEqual(
      withCsp([...BASE.slice(0, 5), "form-action 'self' https://rp.example", BASE[6] ?? '']),
    );
  });

  it('is what withBranding(null) leaves', () => {
    expect(withBranding(MARKUP_ONLY_PAGE.locale, null)).toEqual(MARKUP_ONLY_PAGE.locale);
  });
});

describe('a themed page', () => {
  it('lists only its own asset urls in img-src and style-src', () => {
    const csp = headerMap(themed(branding()))['content-security-policy'] ?? '';
    expect(csp.split('; ')).toEqual([
      "default-src 'none'",
      `style-src ${ORIGIN}${INSTRUMENT_STYLESHEET} ${ORIGIN}/t/acme/theme/abc123.css`,
      "font-src 'self'",
      `img-src ${ORIGIN}/t/acme/theme/logo789.png ${ORIGIN}/t/acme/theme/fav456.png`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'none'",
    ]);
  });

  it('keeps the other directives, script-src and the framing defence as they were', () => {
    const page = themed(branding(), {
      script: { nonce: 'abc', fetchesSameOrigin: false },
      frames: ['https://rp.example'],
    });
    const csp = headerMap(page)['content-security-policy'] ?? '';
    expect(csp.split('; ').filter((d) => !/^(style|img)-src /u.test(d))).toEqual([
      "default-src 'none'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'none'",
      "script-src 'nonce-abc'",
      'frame-src https://rp.example',
    ]);
  });

  it('keeps the instrument favicons when the theme brings none', () => {
    const csp = headerMap(themed(branding({ faviconUrl: null, logo: null, assetUrls: [] })))[
      'content-security-policy'
    ];
    expect(csp).toContain(
      `img-src ${ORIGIN}/instrument/favicon.svg ${ORIGIN}/instrument/favicon.ico`,
    );
  });

  const BAD = [
    'https://evil/x',
    '//evil/x',
    '/a b',
    '/a;b',
    '/a,b',
    "/a'b",
    '/a"b',
    '/a*b',
    '/a\nb',
    '/a\u0000',
    `/${'a'.repeat(256)}`,
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'a/relative',
    '/a?x=1',
    '/',
    '/x/',
    '/a/b/',
    '',
    '/a#f',
  ];
  it.each(BAD)('refuses an asset url that is not a same-origin path: %j', (url) => {
    expect(() => pageHeaders(themed(branding({ assetUrls: [url] })))).toThrow(/branding/u);
    expect(() => pageHeaders(themed(branding({ stylesheetUrl: url })))).toThrow(/branding/u);
    expect(() => pageHeaders(themed(branding({ faviconUrl: url })))).toThrow(/branding/u);
    expect(() => brandingHead(themed(branding({ stylesheetUrl: url })).locale)).toThrow(
      /branding/u,
    );
  });

  it.each(BAD)('reports, without throwing, an asset url that is not a path: %j', (url) => {
    expect(brandingProblems(branding({ assetUrls: [url] })).length).toBeGreaterThan(0);
    expect(brandingProblems(branding({ stylesheetUrl: url })).length).toBeGreaterThan(0);
    expect(brandingProblems(branding({ faviconUrl: url })).length).toBeGreaterThan(0);
  });

  it('reports nothing for a valid branding, and an origin or count problem by name', () => {
    expect(brandingProblems(branding())).toEqual([]);
    expect(brandingProblems(branding({ origin: 'https://a; x' }))).toHaveLength(1);
    const many = Array.from({ length: 17 }, (_, i) => `/t/a/${String(i)}.png`);
    expect(brandingProblems(branding({ assetUrls: many }))).toEqual(['more than 16 urls']);
  });

  it('refuses an origin that is not an origin', () => {
    for (const origin of ['https://a; script-src *', '/x', 'https://a/b', '']) {
      expect(() => pageHeaders(themed(branding({ origin })))).toThrow(/branding/u);
    }
  });

  it('refuses more than 16 urls', () => {
    const urls = (n: number): string[] =>
      Array.from({ length: n }, (_, i) => `/t/a/${String(i)}.png`);
    expect(() =>
      pageHeaders(
        themed(
          branding({ assetUrls: urls(16), faviconUrl: null, logo: null, stylesheetUrl: null }),
        ),
      ),
    ).not.toThrow();
    expect(() =>
      pageHeaders(
        themed(
          branding({ assetUrls: urls(17), faviconUrl: null, logo: null, stylesheetUrl: null }),
        ),
      ),
    ).toThrow(/branding/u);
  });
});

describe('the head a themed page adds', () => {
  const STOCK =
    '<link rel="icon" href="/instrument/favicon.svg" type="image/svg+xml">\n' +
    '<link rel="icon" href="/instrument/favicon.ico" sizes="48x48">';

  it('is the stock favicons alone without branding', () => {
    expect(brandingHead(MARKUP_ONLY_PAGE.locale)).toBe(STOCK);
  });

  it('puts the tenant stylesheet and favicon in place of the stock favicons', () => {
    expect(brandingHead(themed(branding()).locale)).toBe(
      '<link rel="stylesheet" href="/t/acme/theme/abc123.css">\n' +
        '<link rel="icon" href="/t/acme/theme/fav456.png">',
    );
  });

  it('keeps the stock favicons when the theme has none', () => {
    const head = brandingHead(themed(branding({ faviconUrl: null })).locale);
    expect(head).toBe('<link rel="stylesheet" href="/t/acme/theme/abc123.css">\n' + STOCK);
  });
});
