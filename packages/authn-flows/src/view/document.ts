import {
  DEFAULT_PAGE_LOCALE,
  INSTRUMENT_STYLESHEET,
  PRODUCT_NAME,
  isPageTheme,
  type PageLocale,
  type PageScript,
  type RenderedPage,
} from '@odudu/kernel';

// Duplicated per package deliberately, the same choice
// packages/protocol-oidc/src/view/document.ts makes: a package's view layer
// may not reach into another's internals, and the alternative — markup in
// the transport-free kernel package — breaks the layering rule worse.

// Every interpolated value on a rendered page passes through this so
// neither a tenant name nor an error string opens a reflected-XSS hole.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A staff, a ring on a shaft with a collar, in `currentColor`, so the page's own ink colours
// it in either theme, with no inline style for the policy to refuse.
const MARK =
  '<svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">' +
  '<circle cx="16" cy="6" r="4"/><path d="M16 10V30"/><path d="M12 14H20"/></svg>';

// Present only for a choice of light or dark: with none the stylesheet
// follows the operating system, and nothing but one of the two constants is
// ever written.
function themeAttribute(locale: PageLocale): string {
  return locale.theme !== undefined && isPageTheme(locale.theme)
    ? ` data-theme="${locale.theme}"`
    : '';
}

// The heading every page opens with, and what it is for: lines saying what the
// person is continuing to, then the tenant, in the smaller type of a caption.
// `heading` and each context line arrive as markup, already escaped; the
// tenant is a name somebody chose, so it is isolated here.
export function intro(heading: string, tenant?: string, context: readonly string[] = []): string {
  const lines = [
    ...context.map((line) => `<p class="context">${line}</p>\n`),
    ...(tenant === undefined ? [] : [`<p class="tenant"><bdi>${escapeHtml(tenant)}</bdi></p>\n`]),
  ];
  return `<header class="intro">\n<h1>${heading}</h1>\n${lines.join('')}</header>`;
}

// A way on from a page: a path on this server, `text` as escaped markup.
export interface WayOn {
  readonly href: string;
  readonly text: string;
}

// The links that close a page, or nothing when there are none.
export function links(ways: readonly (WayOn | null)[]): string {
  const present = ways.filter((way): way is WayOn => way !== null);
  if (present.length === 0) return '';
  const anchors = present.map((way) => `<a href="${escapeHtml(way.href)}">${way.text}</a>`);
  return `\n<p class="links">\n${anchors.join('\n')}\n</p>`;
}

// The one document shell for every page authn-flows renders. `body` is what a
// theme may replace; `html` is what the server sends today. The stylesheet
// link, favicon, mark and `<main>` belong to the shell, never to `body`.
// See ADR 0030 for why a theme is handed the body and never the document.
export function page(
  title: string,
  body: string,
  script: PageScript | null = null,
  frames: readonly string[] = [],
  locale: PageLocale = DEFAULT_PAGE_LOCALE,
): RenderedPage {
  return {
    title,
    body,
    script,
    frames,
    locale,
    html: `<!doctype html>
<html lang="${escapeHtml(locale.tag)}" dir="${escapeHtml(locale.dir)}"${themeAttribute(locale)}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${INSTRUMENT_STYLESHEET}">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand">${MARK}<span class="wordmark">${PRODUCT_NAME}</span></p>
${body}
</main>
</body>
</html>`,
  };
}
