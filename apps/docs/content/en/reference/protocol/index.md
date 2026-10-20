---
title: 'Request paths'
description: 'Every endpoint Odudu serves today, what a client does with each answer, and what happens on each way a request can go wrong.'
---

# Request paths

Every endpoint Odudu serves today, what a client does with each answer, and
what happens on each way a request can go wrong. Every command below was run
and every response is the one that came back. Unless a block says otherwise
the run was against the compose stack (`infra/docker/compose.yaml`); the
bootstrap and a full authorization-code exchange were additionally run in
each of the other two ways of running the server, which
[Pick how you are running it](./bootstrap.md#pick-how-you-are-running-it) sets out.

Every command is written against `http://localhost:3000`, the port the compose
file publishes by default. A block that was captured on a stack publishing
another port says so in the command itself, and the port in its output is that
stack's: the blocks re-run for the sign-in refusal message, the passkey
button's spacing and the throttle page ran on the project `odudu-17h` on port
`3171`, built from the branch commit `a92240a1` plus the documentation, started
with `ODUDU_THROTTLE_LIMIT=1000 ODUDU_LOGIN_THROTTLE_LIMIT=1000` unless a
block says otherwise.

The `content-security-policy` lines in these guides gained `style-src 'self';
font-src 'self'; img-src 'self'` when pages began linking a same-origin
stylesheet (ADR 0029's amendment). Each page kind was checked against a live
stack on that change (the authorization form, an error page, the logout
confirmation, the console shell), and `tests/docs/page-csp-transcripts.test.ts`
holds every recorded line in all three guides to what `pageHeaders` sends.

Every page document in the three guides now shows the shared shell (the
Instrument stylesheet, the mark and one `<main>`), and every page response
carries `x-content-type-options: nosniff`. That was applied to the recorded
documents by wrapping each in the shell, and to each `content-length` by the
shell's 490 extra bytes, which a live response confirmed (the unknown-client
error page, 704 bytes, on the project `odudu-p4g-12`); those guides were not
replayed end to end. The test above holds the headers of every recorded block,
`nosniff` included. Every page response also carries `content-language`, the
negotiated page language (`en` in every recorded block, since only `en` is
shipped); it was added to the recorded blocks by hand, after `nosniff` where
`pageHeaders` places it, and a live login-page response on the project
`odudu-p4g-13b` confirmed its value and position.

A page follows the colour the person chose in the console. The console writes
the cookie `odudu-theme` (`light` or `dark`; it expires it for `system`), and
every page's `<html>` names that value in `data-theme` and nothing else: with no
cookie, or one holding anything but exactly `light` or `dark`, there is no
attribute and the page follows the operating system, so the recorded documents
below are the bytes served without it. The cookie is a preference, not a secret
or an identifier; the pages are `no-store`, so no `Vary` is needed. Two cases
give no theme that a reader might expect to: the name present twice (a cookie
planted at another path or domain cannot choose), and a `Cookie` header over
8,192 characters (the cap that bounds what a public page parses). Captured
against the project `odudu-p4g-theme`, a new stack with the tenant `acme`
seeded and nothing else:

```
$ U=http://localhost:3180/tenants/acme/protocol/openid-connect/logout
$ PAD=$(printf 'x%.0s' $(seq 1 9000))
$ curl -s "$U" | grep -m1 "<html"
<html lang="en" dir="ltr">
$ curl -s -H 'Cookie: odudu-theme=dark' "$U" | grep -m1 "<html"
<html lang="en" dir="ltr" data-theme="dark">
$ curl -s -H 'Cookie: odudu-theme=LIGHT' "$U" | grep -m1 "<html"
<html lang="en" dir="ltr">
$ curl -s -H 'Cookie: odudu-theme=x"><script>' "$U" | grep -m1 "<html"
<html lang="en" dir="ltr">
$ curl -s -H 'Cookie: odudu-theme=light; odudu-theme=dark' "$U" | grep -m1 "<html"
<html lang="en" dir="ltr">
$ curl -s -H "Cookie: odudu-theme=dark; pad=$PAD" "$U" | grep -m1 "<html"
<html lang="en" dir="ltr">
$ curl -s -H "Cookie: pad=$(printf 'x%.0s' $(seq 1 3000)); odudu-theme=dark" "$U" | grep -m1 "<html"
<html lang="en" dir="ltr" data-theme="dark">
```

The text of the server's own pages now comes from a message catalogue, and a
value somebody else wrote (a client's name, an account's name, a scope label,
an error description) is wrapped in `<bdi>` after it is escaped. Three things
changed in the recorded documents as a result: those values sit inside
`<bdi>…</bdi>`, an apostrophe in a page's own text is `&#39;` (`Can&#39;t
continue`) where it was a bare `'`, and the passkey script reads its three
sentences from `data-` attributes of its form instead of holding them. The
login page with and without a refusal, the error pages (restart link, no row,
unknown client, `415`), the logout confirmation, `Can&#39;t sign out`, the
two consent screens (the second with its client registered through dynamic
registration), the account chooser and the unverified-email page were
each run again on the project `odudu-p4g-14`; every changed line and every
changed `content-length` in the recorded blocks is the byte-for-byte result of
that change, checked against those runs, and the blocks were not replayed end
to end. The two consent screens in [docs/admin-paths.md](../admin-api-paths/index.md) were
re-run the same way on that project, and `tests/docs/page-documents-transcripts.test.ts`
now renders each recorded consent, chooser, error, logout and throttle body back
through the real renderer. Every sentence from the catalogue sits in `<bdi>` on
the error page too, not only text somebody typed, since the page cannot tell them
apart. The sign-in refusal comparison under
[A refused login says so](./path-a-authorization-code-with-pkce.md#a-refused-login-says-so) is a fresh run.

The pages then took one card width and a visual pass, which
[docs/phases/p4g.md](https://github.com/wizzywit/odudu/blob/main/docs/phases/p4g.md#server-pages-the-visual-pass) records. In the
recorded documents that is: the shell opens with `<p class="brand">`, the mark
beside the word `odudu`; a page that knows its tenant puts its `<h1>` in
`<header class="intro">`, with the tenant in `<p class="tenant">` and, on a
sign-in form whose parked request names a client, the line
`to continue to <bdi>…</bdi>`; a refusal is `<p class="alert" role="alert">`;
the update-password violations sit in `<div class="alert" role="alert">`; and
consent's Deny, the chooser's buttons and the passkey button carry classes. That
was applied to the 53 recorded documents and their `content-length` lines by a
script over the documents as they stood, not by replaying the guides end to end.
Seven runs on the project `odudu-p4g-vis` were compared line for line with the
matching recorded document, session ids, ports, secrets and nonces masked: the
sign-in form, the refused sign-in, the TOTP enrolment, the recovery codes, the code
form with and without a refusal, and the update-password page, whose tenant name is
the only difference. The console's sign-in form names its client `Odudu
administration`, the name of the client whose `client_id` is `odudu-admin`.

The authn-flows pages read their text from a catalogue of their own too. The
two that changed in these recordings are the authenticator enrolment page and
the recovery-codes page: the key URI, the key and each recovery code are
wrapped in `<bdi dir="ltr">` so a right-to-left page does not reorder them, which
adds 42 bytes to the first and 210 to the second (`content-length` 1568 to 1778
and 1656 to 1866). The enrolment page, a wrong code, and the recovery codes
page that follows were run on the project `odudu-p4g-15` and the blocks edited
to match (the codes, secret and session id in the blocks are those of the
earlier run, not that one); the change-password pages are byte-for-byte what
they were. `tests/docs/page-documents-transcripts.test.ts` also renders each
recorded enrolment, recovery-codes and change-password body back through its
renderer, with the QR image elided as the blocks show it.

The account pages (registration, verification, reset and the required-actions
link) and the console's sign-in refusal read from catalogues as well. Their
recordings changed only where a page's own text holds an apostrophe, now
`&#39;` (`Can&#39;t create this account`, `we&#39;ve sent`, `This link
can&#39;t be used`): 11 lines. The registration pages, the reset request, form, weak-password, success and
spent-link pages and the verification pages were run again on the project
`odudu-p4g-16` against a tenant with registration, verification and reset on,
and each recorded body that run produced matches the recorded one line for
line; the not-reused reset page and the required-actions pages are what they
were and were not re-run live. The test above now renders these bodies back through their
renderers too.

Values that change on every run — authorization codes, tokens, `jti`,
session ids, timestamps — are shortened or truncated where they appear, and
that is said each time. Nothing here is reconstructed from what the code
looks like it should do.

Three conventions that keep that promise checkable. A fenced block holding a
response **carries no language tag**, because a tagged one is reformatted by
Prettier and what a reader then sees is the formatter's markup rather than
the server's — the bytes below are the bytes served, line breaks included.
Node prints two `ExperimentalWarning` lines about its Web Crypto API on
every CLI invocation; they are on `stderr` and are trimmed from every
transcript here. And a section whose output depends on the state of the
stack it ran against **says which state** — [Retention](./retention-what-odudu-reap-removes.md#retention-what-odudu-reap-removes),
the second [lockout](./brute-force-lockout.md) run and
[the throttle](./brute-force-lockout.md#the-per-origin-throttle) each do. Everything else was run in
the order it appears, front to back, against one stack started with
`ODUDU_THROTTLE_LIMIT=1000 ODUDU_LOGIN_THROTTLE_LIMIT=1000`: a scripted
walkthrough of a whole document sends more requests a minute than the budget
a person needs ([the per-origin throttle](./brute-force-lockout.md#the-per-origin-throttle), and
[the per-username one](./brute-force-lockout.md#the-per-username-budget-on-sign-in) for one user
signing in again and again), and every transcript past the tenth would
otherwise be a `429`.
