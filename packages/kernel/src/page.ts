import { scriptNonce } from '#/ids';
import { isPageTheme, pageThemeFromCookies, type PageTheme } from '#/page-theme';

// What a rendered page needs allowed, when it needs anything beyond
// markup. Returned by the renderer rather than decided by the caller, so
// the page and the policy sent with it cannot disagree — a Content
// Security Policy refusal is invisible in a response and shows up only in
// a real browser, so nothing else would catch a divergence (ADR 0018's
// amendment).
export interface PageScript {
  // The value the page's own <script> element carries.
  nonce: string;
  // Whether that script makes a request of its own. False for a page that
  // was handed everything it needs inline.
  fetchesSameOrigin: boolean;
}

// What a page is rendered for: the language it is written in and the
// direction it reads, negotiated per response by @odudu/i18n (whose own type
// holds those two and is assignable to this one), and the light or dark
// choice read from the request's cookie, which i18n knows nothing of.
// Declared here because the transport-free kernel cannot import i18n.
export interface PageLocale {
  readonly tag: string;
  readonly dir: 'ltr' | 'rtl';
  // The light or dark choice the person made in the console, when they made
  // one; absent means follow the operating system.
  readonly theme?: PageTheme;
}

// The longest authorize path an account page is handed as `return_to`. The page
// that sends it and the page that accepts it read this one value. Encoded into
// a query a path of this length is at most three times as long (every byte
// `%XX`), about 12 KiB of the 16 KiB Node allows a request line and its headers
// together, leaving about 4 KiB for every header, cookies included. A request
// whose headers overflow that is refused with 431 whatever the link, and
// ordinary paths are far shorter than the bound.
export const MAX_SIGN_IN_PATH_LENGTH = 4096;

export const DEFAULT_PAGE_LOCALE: PageLocale = { tag: 'en', dir: 'ltr' };

// A page's theme rides with its negotiated language because every renderer
// already takes that value as its last argument, so a route cannot render a
// page without having been asked for both.
export function withPageTheme(locale: PageLocale, cookieHeader: unknown): PageLocale {
  const theme = pageThemeFromCookies(cookieHeader);
  return theme === undefined ? locale : { ...locale, theme };
}

export interface RenderedPage {
  // The whole document, as the server sends it today.
  html: string;
  // What the renderer put inside the page's <main>, without the shell's
  // own chrome. What a theme is allowed to place; see ADR 0030 for why it
  // is never handed the document.
  body: string;
  // The document's title, so a theme's own shell can set one.
  title: string;
  script: PageScript | null;
  // Rendered into `<html lang dir>` and sent as `Content-Language`.
  locale: PageLocale;
  // The exact origins this page's own markup frames. `frame-src` is derived
  // from it, so a policy can never license an origin the markup does not
  // embed, nor refuse one it does — the failure mode ADR 0018's amendment
  // describes for scripts, which is silent for frames in the same way.
  frames: readonly string[];
  // The validated redirect_uri of the authorization request this page's
  // form continues. Its POST can answer 302 there, and Chromium holds that
  // redirect to `form-action` too, so the policy names its origin.
  redirectsTo?: string;
}

const ORIGIN_SOURCE = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/u;
const SCHEME_SOURCE = /^[a-z][a-z0-9+.-]*:$/u;
// Schemes a redirect_uri never legitimately uses, which a scheme-source
// would license wholesale.
const UNSAFE_SCHEMES = new Set(['javascript:', 'data:', 'blob:', 'file:', 'filesystem:', 'about:']);

// The source expression for where a redirect URI points: its origin, or
// for a private-use scheme (RFC 8252 §7.1), which has no origin, the scheme
// itself. Anything not expressible exactly as one adds nothing.
function formActionSource(redirectUri: string): string | null {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return ORIGIN_SOURCE.test(url.origin) ? url.origin : null;
  }
  if (UNSAFE_SCHEMES.has(url.protocol)) return null;
  return SCHEME_SOURCE.test(url.protocol) ? url.protocol : null;
}

// The one stylesheet every page links, served by @odudu/instrument. A page
// reads no other style, font or image, and a path in a header could not be
// told apart from a typo in a link, so both name this constant.
export const INSTRUMENT_STYLESHEET = '/instrument/instrument.css';

// The product's name as the pages' brand line spells it.
export const PRODUCT_NAME = 'odudu';

// RFC 6749 §10.13's framing defence for the pages rendered to an end-user.
// Almost all of these pages are markup only — no script or frame of their
// own — and take a style, font and image only from their own origin, so
// `default-src 'none'` plus three same-origin directives describes them
// exactly. Nothing inline, nothing remote (ADR 0029's amendment).
// X-Frame-Options: DENY rides alongside `frame-ancestors 'none'` for agents
// with no CSP at all, and may only stay while the two agree. ADR 0018 has
// the reasoning for each directive and for the pairing.
function baseDirectives(page: RenderedPage): string[] {
  const source = page.redirectsTo === undefined ? null : formActionSource(page.redirectsTo);
  return [
    "default-src 'none'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self'",
    "frame-ancestors 'none'",
    source === null ? "form-action 'self'" : `form-action 'self' ${source}`,
    "base-uri 'none'",
  ];
}

// A WebAuthn page is the exception (ADR 0018's amendment): only a script
// can reach an authenticator, and `default-src 'none'` blocks an inline one
// silently, so the page looks broken rather than refused. The page says
// what it carries and the policy is derived from that — never assembled
// beside it, which is how a header and an element come to disagree.
function policyFor(page: RenderedPage): string {
  const script = page.script;
  const base = baseDirectives(page);
  const directives =
    script === null
      ? base
      : [
          ...base,
          `script-src 'nonce-${script.nonce}'`,
          // Only for a script that actually makes a request. A page handed
          // its options inline asks for nothing, and a directive licensing
          // nothing stops describing the page.
          ...(script.fetchesSameOrigin ? ["connect-src 'self'"] : []),
        ];
  // Two clients may register a logout URI on the same host, and the list is
  // built per relying party, so a duplicate origin is expected rather than
  // exceptional.
  const framed = [...new Set(page.frames.filter((origin) => ORIGIN_SOURCE.test(origin)))];
  if (framed.length > 0) directives.push(`frame-src ${framed.join(' ')}`);
  return directives.join('; ');
}

// Every page is bound to a browser's own attempt: a form carrying an
// `auth_session_id`, a token in a query string, a session that was just
// ended. `no-store` (RFC 9111 §5.2.2.5) is the one directive that keeps such a
// page out of every cache. `Pragma` is not sent: RFC 9111 §5.4 deprecates it,
// and `no-cache` and `Expires: 0` only add what `no-store` already says.
// ADR 0029's amendment has what this does and does not stop.
const PAGE_CACHE_CONTROL = 'no-store';

// The one authority for the headers every rendered page carries, so a
// package's reply wrapper is two lines that spread this and cannot
// diverge from another package's. Every renderer returns a RenderedPage —
// the nonce its own markup used travels with it, so the policy sent with a
// page can never name a script the page does not carry.
// What may reach a header: a tag negotiated from the shipped list has this
// shape already, so anything else is a bug, never input.
const DIRECTIONS: ReadonlySet<string> = new Set(['ltr', 'rtl']);
const SAFE_TAG = /^[A-Za-z0-9-]{1,35}$/u;

export function pageHeaders(page: RenderedPage): readonly (readonly [string, string])[] {
  if (!SAFE_TAG.test(page.locale.tag) || !DIRECTIONS.has(page.locale.dir)) {
    throw new Error('refusing to send an unvalidated locale');
  }
  if (page.locale.theme !== undefined && !isPageTheme(page.locale.theme)) {
    throw new Error('refusing to send an unvalidated theme');
  }
  return [
    ['content-security-policy', policyFor(page)],
    // Governs this page being framed, not this page framing others — that
    // direction is `frame-src`, above. Untouched by `frames`.
    ['x-frame-options', 'DENY'],
    // Defence in depth for the query-string tokens some of these pages
    // carry: default-src already stops a subresource leaking one via
    // Referer, but a link a user clicks away from is not a subresource.
    ['referrer-policy', 'no-referrer'],
    ['cache-control', PAGE_CACHE_CONTROL],
    // The page's own type is the one it is served as; a browser has no
    // business guessing another from its bytes.
    ['x-content-type-options', 'nosniff'],
    ['content-language', page.locale.tag],
  ];
}

// A page restored from the back/forward cache is the DOM it was left with,
// so a form bound to an authentication session that has since expired comes
// back looking alive. `pageshow` with `persisted` is the one signal a
// restore gives; reloading re-requests the GET that started the attempt.
// The restored form shows for a moment first, which is acceptable for a
// form and would not be for a secret (ADR 0029's amendment). Apply it only
// to a page that answered a GET: a reload re-sends a POST.
const RELOAD_ON_RESTORE =
  "window.addEventListener('pageshow', function (event) { if (event.persisted) location.reload(); });";

export function reloadOnRestore(page: RenderedPage): RenderedPage {
  const nonce = page.script?.nonce ?? scriptNonce();
  const element = `<script nonce="${nonce}">${RELOAD_ON_RESTORE}</script>`;
  const end = page.html.lastIndexOf('</body>');
  return {
    ...page,
    html:
      end === -1
        ? `${page.html}\n${element}`
        : `${page.html.slice(0, end)}${element}\n${page.html.slice(end)}`,
    body: `${page.body}\n${element}`,
    script: page.script ?? { nonce, fetchesSameOrigin: false },
  };
}
