import {
  INSTRUMENT_STYLESHEET,
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

const DEFAULT_LOCALE: PageLocale = { tag: 'en', dir: 'ltr' };

// A plain ring on a shaft in `currentColor`, so the page's own ink colours
// it in either theme, with no inline style for the policy to refuse.
const MARK =
  '<svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" ' +
  'stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">' +
  '<circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg>';

// The one document shell for every page account renders. `body` is what a
// theme may replace; `html` is what the server sends today. The stylesheet
// link, favicon, mark and `<main>` belong to the shell, never to `body`.
// See ADR 0030 for why a theme is handed the body and never the document.
export function page(
  title: string,
  body: string,
  script: PageScript | null = null,
  frames: readonly string[] = [],
  locale: PageLocale = DEFAULT_LOCALE,
): RenderedPage {
  return {
    title,
    body,
    script,
    frames,
    locale,
    html: `<!doctype html>
<html lang="${escapeHtml(locale.tag)}" dir="${escapeHtml(locale.dir)}">
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
${MARK}
${body}
</main>
</body>
</html>`,
  };
}
