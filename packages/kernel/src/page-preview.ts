import { createHash } from 'node:crypto';
import { stylesheetLink, type PageLocale, type RenderedPage } from '#/page';

// What a package renders a kind with for the theme preview: its own renderer,
// handed fixed sample values, so the page is the one a person would be sent.
export type PreviewRender = (tenant: string, locale: PageLocale) => RenderedPage;

// The most the inlined stylesheet and images may add to the page.
export const MAX_PREVIEW_BYTES = 1024 * 1024;

export interface PreviewInline {
  // The path the page links the tenant's stylesheet at, when it does.
  readonly stylesheetUrl: string | null;
  readonly css: string;
  // Each public image path of the theme and the data URI standing for it.
  readonly images: ReadonlyMap<string, string>;
}

export interface InlinedPreview {
  readonly html: string;
  // Base64 of the inlined stylesheet's digest, null when none was inlined.
  readonly styleSha256: string | null;
  // Whether the page's own script was taken out, since the preview's policy
  // licenses none.
  readonly scriptOmitted: boolean;
}

function replaceAll(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

function withoutScript(page: RenderedPage): { html: string; omitted: boolean } {
  if (page.script === null) return { html: page.html, omitted: false };
  const open = `<script nonce="${page.script.nonce}">`;
  const start = page.html.indexOf(open);
  const end = start === -1 ? -1 : page.html.indexOf('</script>', start);
  if (end === -1) return { html: page.html, omitted: false };
  return {
    html: page.html.slice(0, start) + page.html.slice(end + '</script>'.length),
    omitted: true,
  };
}

// The page as `page` rendered it, with the theme's own files carried inside
// it, so nothing the draft holds needs a public URL. A stylesheet that
// contains `<` is left out: the sanitiser refuses one, and a policy hash
// cannot make an element that closes early safe.
export function inlinePreview(page: RenderedPage, inline: PreviewInline): InlinedPreview {
  const stripped = withoutScript(page);
  let html = stripped.html;
  let styleSha256: string | null = null;
  if (inline.stylesheetUrl !== null) {
    let css = inline.css;
    for (const [path, uri] of inline.images) css = replaceAll(css, path, uri);
    const link = stylesheetLink(inline.stylesheetUrl);
    if (css.includes('<')) {
      html = replaceAll(html, link, '');
    } else {
      html = replaceAll(html, link, `<style>${css}</style>`);
      styleSha256 = createHash('sha256').update(css).digest('base64');
    }
  }
  for (const [path, uri] of inline.images) html = replaceAll(html, path, uri);
  return { html, styleSha256, scriptOmitted: stripped.omitted };
}

// The headers of the preview response and the only ones: it is a response of
// its own, never run through `pageHeaders`, which keeps every other page
// unframable. The console frames this one, so `frame-ancestors` is the
// origin it is served from, and the policy has no script source at all.
// `'self'` for style and font is the Instrument stylesheet every page links,
// which is public and fetched without credentials.
export function previewHeaders(inlined: InlinedPreview): readonly (readonly [string, string])[] {
  const style = inlined.styleSha256 === null ? "'self'" : `'self' 'sha256-${inlined.styleSha256}'`;
  return [
    [
      'content-security-policy',
      [
        "default-src 'none'",
        `style-src ${style}`,
        "font-src 'self'",
        'img-src data:',
        "frame-ancestors 'self'",
        "form-action 'none'",
        "base-uri 'none'",
      ].join('; '),
    ],
    ['referrer-policy', 'no-referrer'],
    ['cache-control', 'no-store'],
    ['x-content-type-options', 'nosniff'],
  ];
}
