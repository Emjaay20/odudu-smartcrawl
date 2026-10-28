import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pageHeaders, stylesheetLink, type RenderedPage } from '#/page';
import { MAX_PREVIEW_BYTES, inlinePreview, previewHeaders } from '#/page-preview';

const SHEET = '/tenants/acme/brand/' + 'a'.repeat(64) + '.css';
const LOGO = '/tenants/acme/brand/' + 'b'.repeat(64) + '.png';
const LOGO_URI = 'data:image/png;base64,AAAA';

function pageWith(html: string, script: RenderedPage['script'] = null): RenderedPage {
  return {
    html,
    body: html,
    title: 'T',
    script,
    frames: [],
    locale: { tag: 'en', dir: 'ltr' },
  };
}

const POLICY = (headers: readonly (readonly [string, string])[]): string =>
  headers.find(([name]) => name === 'content-security-policy')?.[1] ?? '';

describe('inlinePreview', () => {
  const html = `<head>${stylesheetLink(SHEET)}</head><img src="${LOGO}">`;

  it('replaces the linked stylesheet with its text and names its hash', () => {
    const css = `.a{background:url(${LOGO})}`;
    const out = inlinePreview(pageWith(html), {
      stylesheetUrl: SHEET,
      css,
      images: new Map([[LOGO, LOGO_URI]]),
    });
    const inlined = `.a{background:url(${LOGO_URI})}`;
    expect(out.html).toContain(`<style>${inlined}</style>`);
    expect(out.html).not.toContain('<link rel="stylesheet" href="/tenants');
    expect(out.html).toContain(`<img src="${LOGO_URI}">`);
    expect(out.styleSha256).toBe(createHash('sha256').update(inlined).digest('base64'));
  });

  it('takes no hash when the theme links no stylesheet', () => {
    const out = inlinePreview(pageWith('<p>x</p>'), {
      stylesheetUrl: null,
      css: '',
      images: new Map(),
    });
    expect(out.styleSha256).toBeNull();
  });

  it('removes the page script and says so', () => {
    const page = pageWith('<p>a</p><script nonce="n+/=">start()</script><p>b</p>', {
      nonce: 'n+/=',
      fetchesSameOrigin: false,
    });
    const out = inlinePreview(page, { stylesheetUrl: null, css: '', images: new Map() });
    expect(out.html).toBe('<p>a</p><p>b</p>');
    expect(out.scriptOmitted).toBe(true);
  });

  it('does not inline a stylesheet that could close its own element', () => {
    const out = inlinePreview(pageWith(stylesheetLink(SHEET)), {
      stylesheetUrl: SHEET,
      css: 'a{}</style><script>x</script>',
      images: new Map(),
    });
    expect(out.html).not.toContain('<script>');
    expect(out.styleSha256).toBeNull();
  });
});

describe('previewHeaders', () => {
  const inlined = { html: '', styleSha256: 'abc=', scriptOmitted: false };

  it('lets the console frame the response and nothing else frame it', () => {
    const policy = POLICY(previewHeaders(inlined));
    expect(policy.split('; ')).toContain("frame-ancestors 'self'");
  });

  it('licenses only the inlined stylesheet and data images, and no script', () => {
    const policy = POLICY(previewHeaders(inlined));
    const directives = policy.split('; ');
    expect(directives).toContain("default-src 'none'");
    expect(directives).toContain("style-src 'self' 'sha256-abc='");
    expect(directives).toContain('img-src data:');
    expect(policy).not.toContain('script-src');
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('is not cached, not sniffed and sends no referrer', () => {
    const headers = Object.fromEntries(previewHeaders(inlined));
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-frame-options']).toBeUndefined();
  });

  it('leaves the headers of an ordinary page as they were', () => {
    const headers = Object.fromEntries(pageHeaders(pageWith('<p>')));
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});

it('bounds what is inlined at 1 MiB', () => {
  expect(MAX_PREVIEW_BYTES).toBe(1024 * 1024);
});
