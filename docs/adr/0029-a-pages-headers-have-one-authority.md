# 0029 — A page's headers have one authority

**Status:** Accepted · 2026-09-18

## Context

Every HTML page Odudu renders to an end-user is supposed to leave through
one function that sets its security headers. There were two.

`packages/protocol-oidc/src/view/html-response.ts`'s `sendHtml` derives the
Content Security Policy from the page's own declared script (ADR 0018's
amendment). `packages/account/src/view/verification-html.ts`'s
`sendVerificationHtml` hand-copied that policy, with a comment correctly
explaining why it could not import the first: `html-response.ts` is a
protocol package's internal, and no feature reaches into another's
internals (CLAUDE.md, Layering).

The two had already diverged. `sendVerificationHtml` sent
`referrer-policy: no-referrer`, defence in depth for the query-string
tokens the verification pages carry; `sendHtml` did not. Each exit was
correct on its own terms and incomplete against the other's, which is what
a hand-copy guarantees over time.

## Decision

The header set becomes a pure function, `pageHeaders`, in `@odudu/kernel`.
Every package's reply wrapper becomes two lines that spread its result over
a `FastifyReply` — `sendHtml` and `sendVerificationHtml` keep existing, but
neither owns the policy any more. `referrer-policy: no-referrer` moves onto
every page, not only the verification ones: no page is harmed by it, and
the tokens it defends are not unique to that feature.

`kernel` can hold this because the function is pure. `sendHtml` takes a
`FastifyReply`; `kernel`'s dependencies are `uuidv7` and `zod` only,
deliberately transport-free (verified:
`sed -n '/"dependencies"/,/}/p' packages/kernel/package.json`,
2026-09-18). Splitting the policy from the reply is what lets the policy
live where every package can reach it without adding `fastify` to the one
package everything depends on.

`html-response.test.ts` gains the rule this task exists to create: no
`*-html.ts` and no route file, in any package's view layer, names
`content-security-policy`, `x-frame-options` or `referrer-policy` — except
the two files that spread `pageHeaders`' result. A lint test that only
knows a name is present cannot verify a _value_, but a third hand-copy
cannot appear undetected either.

## Consequences

- "One exit" is explicitly **not** what was promised. There remain two
  `send*` functions, because `FastifyReply` cannot live in `kernel`. The
  promise is one **authority**: both exits spread the same headers, and
  neither can drift from the other without also drifting from
  `pageHeaders`, which is unit-tested directly.
- A third package adding a rendered page writes its own two-line wrapper
  spreading `pageHeaders`, not a third hand-copy — the new exit test fails
  the build the moment it names a header itself instead.
- `kernel` stays transport-free. Every future header this policy needs
  (a new directive, a new page-level default) is a change to one function,
  reachable from every package without a new dependency edge.

## Amendment — 2026-09-28 — the console shell

The administration console's shell,
`packages/console-gateway/src/view/spa.ts`, is the one static-serving
exception, and the third file `html-response.test.ts` lets name a page
header. It serves a built single-page app, not a server-rendered page: it
has no inline script and no per-request nonce, and its policy licenses a
self-hosted script and two style hashes: the `<style>` elements React
Aria's `usePress` injects everywhere and `usePreventScroll` injects on iOS
WebKit, which `packages/console-gateway/src/view/react-aria-style.test.ts`
recomputes from the pinned source. So it sets that fixed policy itself
rather than through `pageHeaders`, whose policy describes a markup-only
page. The two-wrapper rule above covers server-rendered pages; design spec
§5.4 (`docs/superpowers/specs/2026-09-26-p4d-admin-console-design.md`)
gives the shell's policy.

## Amendment — 2026-10-14 — a form left open, and Back

A login form was restored by the browser's Back button with its typed
username and a dead `auth_session_id`, and every resubmit failed the same
way. No page carried a `Cache-Control` header, so the browser showed its own
copy rather than asking `/authorize` for a fresh session.

**What the standards say** (checked 2026-10-13, cited by title because
numbering differs by version). No OAuth or OIDC specification requires a
cache header on the interactive login page; RFC 9700 gives no such rule
either, and this ADR does not claim one. `no-store` is normative on token
responses (RFC 6749 §5.1, OIDC Core §3.1.3.3) and a SHOULD on the logout
endpoints (OIDC Back-Channel Logout §2.8, Front-Channel Logout §2). The
recommendation for pages carrying session-bound state is anti-caching headers:
OWASP ASVS's anti-caching requirement (V8.2.1 in 4.0.x, V9.4 in 5.0) and the
OWASP Session Management and Web Cache Security cheat sheets. Mature
providers restart an expired sign-in instead of dead-ending (Keycloak's
timeout page links back to the start); that is practice, not a specification.
Chrome (developer.chrome.com/docs/web-platform/bfcache-ccns, 2025-09) now
restores `no-store` pages from the back/forward cache for up to three minutes
unless cookies change, so the header alone does not stop a restored dead form;
its advice is to reload on `pageshow` with `event.persisted`.

**Three layers, each needed.**

1. `pageHeaders` adds `cache-control: no-store` to every page it covers. One
   directive, not OWASP's cross-browser set: `Pragma` is deprecated
   (RFC 9111 §5.4), and `no-cache` and `Expires: 0` add nothing to a
   `no-store` that every current browser honours. Verified in Chromium:
   `apps/admin-console/e2e/restart-sign-in.spec.ts` goes Back from the refusal
   and gets a form under a new `auth_session_id`.
2. `reloadOnRestore` (`@odudu/kernel`) adds one `pageshow` script, on the
   page's own nonce so `script-src` is derived from the return value as
   above, reloading when `event.persisted`. Verified in Chrome: a form was
   restored from the cache with `persisted` true and its stale id, then
   reloaded under a new one. It is applied to the login form, account chooser
   and consent page when `/authorize` answers a GET, and nowhere else: a page
   that answers a POST would be re-sent by a reload, and the required-action
   pages issue secrets when rendered. The restored form shows for a moment
   before the reload, acceptable for a form and not for a secret. Playwright's
   Chromium has no back/forward cache, so this layer is covered by markup and
   policy tests and by the manual run above.
3. A submission whose authentication session is expired, consumed or unknown
   answers with the same refusal as before; when the row still exists (the
   reaper keeps it `ODUDU_RETENTION_AUTHENTICATION_SESSION_SECONDS`, an hour
   by default, past expiry) the page adds "Start sign-in again", a path on this
   server rebuilt from the parked request, which `/authorize` validates
   afresh. The row authenticates nothing. A request that carried an
   `id_token_hint` or a `claims` `sub` is not rebuilt, since the hint token
   is not stored and the rebuilt request would no longer be tied to a subject.

**What `no-store` costs.** Back to a sign-in page is a request, not a cache
hit: a person who goes Back sees a form fetched again and a new authentication
session row. Rows are reaped, so the cost is a write per visit on a path that
already writes one. Nothing hashed is affected: the console's assets under
`/console/assets/` stay cacheable. The console shell's `index.html` already
sent `no-store` and keeps setting it in `spa.ts` beside its own policy; that
file does not spread `pageHeaders`, so nothing changed there.

## Alternatives rejected

- **Move `sendHtml` itself into `kernel`.** Would add `fastify` as a
  dependency of the package every other package depends on, for the sake
  of a two-line wrapper that already fits in the packages that need it.
- **A new `@odudu/web` package.** One function does not justify a package;
  `RenderedPage`, the type this function already consumes, lives in
  `kernel`.
- **Leave both exits and document the duplication.** This is the state
  the codebase was already in — a correct comment explaining why the
  duplication existed did not stop it from drifting.
