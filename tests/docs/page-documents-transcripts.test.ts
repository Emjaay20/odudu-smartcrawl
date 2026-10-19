import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_LOCALE as LOCALE } from '../../packages/kernel/src/index.js';
import {
  renderAuthorizeErrorPage,
  type WayOn,
} from '../../packages/protocol-oidc/src/view/authorize-html.js';
import { renderConsentPage } from '../../packages/protocol-oidc/src/view/consent-html.js';
import { page } from '../../packages/protocol-oidc/src/view/document.js';
import {
  renderLoggedOutPage,
  renderLogoutConfirmationPage,
  renderLogoutUnauthenticatedPage,
  renderNoActiveSessionPage,
} from '../../packages/protocol-oidc/src/view/logout-html.js';
import { renderSelectAccountPage } from '../../packages/protocol-oidc/src/view/select-account-html.js';
import { renderThrottledPage } from '../../packages/protocol-oidc/src/view/throttled-html.js';
import { renderRecoveryCodesPage } from '../../packages/authn-flows/src/view/recovery-codes-html.js';
import { renderTotpEnrolmentPage } from '../../packages/authn-flows/src/view/totp-enrolment-html.js';
import { renderUpdatePasswordPage } from '../../packages/authn-flows/src/view/update-password-html.js';
import { loadDocument, scanFences } from './markdown.js';

// A recorded page response is a claim about bytes: its `content-length` is
// the length of the document under it, and the document is the shell around
// the page's own markup. A block that shows only part of a document says so
// with a `…` in its body; every other block is held to the shell and, where
// it shows a `content-length`, to that length.
const GUIDES = ['docs/request-paths.md', 'docs/console-paths.md', 'docs/admin-paths.md'];
const MARKER = '@@';

interface Recorded {
  readonly where: string;
  readonly lines: readonly string[];
}

function recorded(): Recorded[] {
  return GUIDES.flatMap((guide) =>
    scanFences(loadDocument(guide)).spans.flatMap((span) => {
      const start = span.body.indexOf('<!doctype html>');
      const page = span.body.some((line) =>
        line.startsWith("content-security-policy: default-src 'none'"),
      );
      if (!(span.body[0] ?? '').startsWith('HTTP/1.1 ') || start === -1 || !page) return [];
      return [{ where: `${guide}:${String(span.startLine)}`, lines: span.body }];
    }),
  );
}

// A fence may go on to hold the next command, so the document ends at its own
// closing tag when it has one.
function documentOf(block: Recorded): string[] {
  const rest = block.lines.slice(block.lines.indexOf('<!doctype html>'));
  const end = rest.indexOf('</html>');
  return end === -1 ? rest : rest.slice(0, end + 1);
}
const isPartial = (block: Recorded): boolean =>
  documentOf(block).some((line) => line.includes('…'));
const complete = (): Recorded[] => recorded().filter((block) => !isPartial(block));

// reloadOnRestore appends this after the shell's closing `</main>`.
const RELOAD_ON_RESTORE =
  /\n<script nonce="[^"]*">window\.addEventListener\('pageshow'[^\n]*<\/script>\n<\/body>/u;

// The shell around a page, split where a title and a body go.
const [BEFORE_TITLE = '', BETWEEN = '', AFTER_BODY = ''] = page(MARKER, MARKER).html.split(MARKER);

// The title is recorded as served, escaped; page() escapes what it is given.
const unescaped = (text: string): string =>
  text
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, '&');

describe('the page documents the guides record', () => {
  it('finds complete documents in every guide, so an empty scan cannot pass', () => {
    for (const guide of GUIDES) {
      expect(
        complete().some((block) => block.where.startsWith(`${guide}:`)),
        guide,
      ).toBe(true);
    }
  });

  it('shows a document that stops short only with a … in it', () => {
    const unmarked = recorded()
      .filter((block) => !isPartial(block) && documentOf(block).at(-1) !== '</html>')
      .map((block) => block.where);
    expect(unmarked).toEqual([]);
  });

  it('gives each complete document the content-length its bytes have', () => {
    const wrong = complete().flatMap((block) => {
      const header = block.lines.find((line) => line.startsWith('content-length: '));
      if (header === undefined) return [];
      const bytes = Buffer.byteLength(documentOf(block).join('\n'));
      return header === `content-length: ${String(bytes)}`
        ? []
        : [`${block.where}: ${header}, ${String(bytes)} bytes`];
    });
    expect(wrong).toEqual([]);
  });

  it('wraps each complete document in the shell page() builds', () => {
    const drift = complete().flatMap((block) => {
      const text = documentOf(block).join('\n').replace(RELOAD_ON_RESTORE, '\n</body>');
      const titleEnd = text.indexOf(BETWEEN, BEFORE_TITLE.length);
      const ok =
        text.startsWith(BEFORE_TITLE) &&
        titleEnd !== -1 &&
        text.endsWith(AFTER_BODY) &&
        page(
          unescaped(text.slice(BEFORE_TITLE.length, titleEnd)),
          text.slice(titleEnd + BETWEEN.length, text.length - AFTER_BODY.length),
        ).html === text;
      return ok ? [] : [block.where];
    });
    expect(drift).toEqual([]);
  });
});

// The page's own markup, as recorded: what sits between the shell's mark and
// its closing `</main>`.
function bodyOf(block: Recorded): string {
  const text = documentOf(block).join('\n').replace(RELOAD_ON_RESTORE, '\n</body>');
  const titleEnd = text.indexOf(BETWEEN, BEFORE_TITLE.length);
  return text.slice(titleEnd + BETWEEN.length, text.length - AFTER_BODY.length);
}

const titleOf = (block: Recorded): string =>
  unescaped(/<title>([^<]*)<\/title>/u.exec(documentOf(block).join('\n'))?.[1] ?? '');
const first = (text: string, pattern: RegExp): string => unescaped(pattern.exec(text)?.[1] ?? '');
const all = (text: string, pattern: RegExp): string[] =>
  [...text.matchAll(pattern)].map((m) => unescaped(m[1] ?? ''));

// The rule codes the domain reports, so a recorded violation is read back by
// asking the real page which rule renders as that sentence.
const RULES = [
  'min-length',
  'max-length',
  'require-digit',
  'require-uppercase',
  'require-lowercase',
  'require-special',
  'not-username',
  'not-email',
  'not-reused',
  'superseded',
];

function violationFor(sentence: string): { rule: string; message: string; minLength?: number } {
  const minLength = Number(/at least (\d+) characters/u.exec(sentence)?.[1] ?? 0);
  for (const rule of RULES) {
    const candidate = { rule, message: 'x', minLength };
    const rendered = renderUpdatePasswordPage('t', 's', [candidate], LOCALE).body;
    if (first(rendered, /<li>(.*)<\/li>/u) === sentence) return candidate;
  }
  return { rule: 'unknown', message: sentence };
}

// A recording shows the QR image as an elision, so the page is read back
// with the same one standing where the image is.
const QR_ELIDED = '<svg …>…</svg>';
const elidesOnlyTheQr = (block: Recorded): boolean =>
  documentOf(block)
    .filter((line) => line.includes('…'))
    .every((line) => line === QR_ELIDED);

// What the recorded markup says its inputs were, put back through the real
// renderer: a page whose text or markup the server no longer produces for the
// same inputs is named here. It cannot see a branch no recording takes, the
// login forms (too many inputs to read back), the passkey and pending-action
// pages of authn-flows (recorded nowhere), the pages of account or the
// console, or a value the markup does not show.
const RENDER_BACK: Record<string, (body: string) => string> = {
  'Set up your authenticator': (body: string) =>
    renderTotpEnrolmentPage(
      first(body, /action="\/tenants\/([^/"]*)\//u),
      first(body, /name="auth_session_id" value="([^"]*)"/u),
      {
        secret: first(body, /name="secret" value="([^"]*)"/u),
        uri: first(body, /<p><bdi dir="ltr"><code>(otpauth:[^<]*)<\/code><\/bdi><\/p>/u),
      },
      /^<p><strong>/mu.test(body) ? 'code_mismatch' : undefined,
      LOCALE,
    ).body.replace(/<svg version=[\s\S]*?<\/svg>/u, QR_ELIDED),
  'Save your recovery codes': (body: string) =>
    renderRecoveryCodesPage(
      first(body, /action="\/tenants\/([^/"]*)\//u),
      first(body, /name="auth_session_id" value="([^"]*)"/u),
      {
        codes: all(body, /^ {2}<li><bdi dir="ltr"><code>(.*)<\/code><\/bdi><\/li>$/gmu),
        replaced: body.includes('<p>These replace the codes'),
      },
      /^<p><strong>/mu.test(body) ? 'codes_not_saved' : undefined,
      LOCALE,
    ).body,
  'Change your password': (body: string) =>
    renderUpdatePasswordPage(
      first(body, /action="\/tenants\/([^/"]*)\//u),
      first(body, /name="auth_session_id" value="([^"]*)"/u),
      all(body, /^<li>(.*)<\/li>$/gmu).map(violationFor),
      LOCALE,
    ).body,
  'Allow access?': (body) => {
    const link = (label: RegExp): string | null => {
      const href = /<a href="([^"]*)">/u;
      const found = new RegExp(`<a href="[^"]*">${label.source}</a>`, 'u').exec(body);
      return found === null ? null : first(found[0], href);
    };
    const optional = [
      ...body.matchAll(
        /<label><input type="checkbox" name="scope" value="([^"]*)"( checked)?> <bdi>([^<]*)<\/bdi>/gu,
      ),
    ];
    return renderConsentPage(
      {
        tenant: first(body, /action="\/tenants\/([^/"]*)\//u),
        authSessionId: first(body, /name="auth_session_id" value="([^"]*)"/u),
        clientName: first(body, /<h1><bdi>(.*?)<\/bdi> is asking/u),
        clientPages: {
          clientUri: link(/About <bdi>.*?<\/bdi>/u),
          policyUri: link(/Privacy policy/u),
          tosUri: link(/Terms of service/u),
        },
        defaultScopes: all(body.slice(body.indexOf('<ul>')), /^ {2}<li><bdi>(.*)<\/bdi><\/li>$/gmu),
        optionalScopes: optional.map((m) => unescaped(m[1] ?? '')),
        alreadyGranted: optional
          .filter((m) => m[2] !== undefined)
          .map((m) => unescaped(m[1] ?? '')),
        scopeLabels: Object.fromEntries(
          optional.map((m) => [unescaped(m[1] ?? ''), unescaped(m[3] ?? '')]),
        ),
      },
      LOCALE,
    ).body;
  },
  'Choose an account': (body) =>
    renderSelectAccountPage(
      {
        tenant: first(body, /action="\/tenants\/([^/"]*)\//u),
        authSessionId: first(body, /name="auth_session_id" value="([^"]*)"/u),
        accounts: [...body.matchAll(/name="session_id" value="([^"]*)"><bdi>(.*?)<\/bdi>/gu)].map(
          (m) => ({ sessionId: unescaped(m[1] ?? ''), displayName: unescaped(m[2] ?? '') }),
        ),
      },
      LOCALE,
    ).body,
  'Sign-in error': (body) => {
    const href = /<p><a href="([^"]*)">([^<]*)<\/a><\/p>/u.exec(body);
    const wayOn: WayOn | undefined =
      href === null
        ? undefined
        : {
            kind: href[2] === 'Start sign-in again' ? 'restart' : 'return',
            href: unescaped(href[1] ?? ''),
          };
    return renderAuthorizeErrorPage(
      first(body, /<small>(.*)<\/small>/u),
      first(body, /<p><bdi>(.*)<\/bdi><\/p>/u),
      wayOn,
      LOCALE,
    ).body;
  },
  'Sign out?': (body) =>
    renderLogoutConfirmationPage(
      first(body, /action="\/tenants\/([^/"]*)\//u),
      first(body, /name="session_id" value="([^"]*)"/u),
      first(body, /name="csrf" value="([^"]*)"/u),
      {
        clientId: /name="client_id" value="([^"]*)"/u.test(body)
          ? first(body, /name="client_id" value="([^"]*)"/u)
          : null,
        postLogoutRedirectUri: body.includes('name="post_logout_redirect_uri"')
          ? first(body, /name="post_logout_redirect_uri" value="([^"]*)"/u)
          : null,
        state: body.includes('name="state"') ? first(body, /name="state" value="([^"]*)"/u) : null,
      },
      LOCALE,
    ).body,
  "Can't sign out": () => renderLogoutUnauthenticatedPage(LOCALE).body,
  'Already signed out': () => renderNoActiveSessionPage(LOCALE).body,
  'Too many attempts': (body) =>
    renderThrottledPage(Number(first(body, /Try again in (\d+) second/u)), LOCALE).body,
  'Signed out': (body) => {
    const frames = all(body, /<iframe src="([^"]*)"><\/iframe>/gu);
    return renderLoggedOutPage(frames, LOCALE).body;
  },
};

// Every complete document in the guides, with or without the response head
// above it.
function documents(): Recorded[] {
  return GUIDES.flatMap((guide) =>
    scanFences(loadDocument(guide)).spans.flatMap((span) =>
      span.body.includes('<!doctype html>')
        ? [{ where: `${guide}:${String(span.startLine)}`, lines: span.body }]
        : [],
    ),
  ).filter((block) => !isPartial(block) || elidesOnlyTheQr(block));
}

describe('the pages the guides record are what the renderers produce for the same inputs', () => {
  it('covers a consent screen, so an empty scan cannot pass', () => {
    expect(documents().some((block) => titleOf(block) === 'Allow access?')).toBe(true);
  });

  it('renders each recorded body back to the same markup', () => {
    const drift = documents().flatMap((block) => {
      const render = RENDER_BACK[titleOf(block)];
      if (render === undefined) return [];
      const body = bodyOf(block);
      return render(body) === body ? [] : [block.where];
    });
    expect(drift).toEqual([]);
  });
});
