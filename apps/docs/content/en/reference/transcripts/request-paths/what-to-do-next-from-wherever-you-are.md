---
title: 'What to do next, from wherever you are'
description: 'From a rendered error page at /authorize. The client never sees it.'
---

# What to do next, from wherever you are

**From a rendered error page at `/authorize`.** The client never sees it.
Something about the client's registration is wrong — the `client_id`, the
`redirect_uri`, the tenant in the URL. Fix the request, or the registration,
and start again. Nothing was created server-side.

**From a redirect carrying `error`.** Match `state` to the request you
started, check `iss`, and give up on this attempt. `login_required` has two
causes: `prompt=none` forbade the interaction that was needed, in which
case retry without `prompt`; or the request carried an `id_token_hint` and
somebody else signed in, in which case retrying unchanged will keep failing
until the hinted user is the one at the keyboard.
`invalid_scope`, `unsupported_response_type`, `request_not_supported` and
the PKCE `invalid_request`s are bugs in the client, not transient failures;
retrying unchanged produces the same answer.

**From a `code`.** Verify `state` and `iss` first. Then redeem it at
`/token` with the same `redirect_uri` and the `code_verifier` you kept,
within the tenant's code lifetime (60 seconds by default), exactly once. Do
not retry a redemption that returned
`invalid_grant` — if it succeeded once, retrying revokes the grant you just
received.

**From an access token.** Send it as `Authorization: Bearer …` to
`/userinfo` or to your own API. It lives 300 seconds. A resource server
validating it should verify the signature against the tenant's JWKS, then
`typ: at+jwt`, `iss`, `exp`, and that it is named in `aud` — and then check
`scope` for whatever the call requires. A resource server named in `aud`
can instead call `/introspect` (RFC 7662), authenticating with its own
client credentials, to learn whether the grant behind the token has since
been revoked or its session has ended — the one check local validation
alone cannot make before `exp`. A client holding either the access token or
its refresh token can also end the grant deliberately with `/revoke` (RFC 7009) — see [Token introspection and
revocation](./rp-initiated-logout.md#token-introspection-and-revocation).

**From a refresh token.** Present it at `/token` when the access token is
about to expire, and **replace your stored copy with the one that comes
back**. Never retry a refresh with the token you already sent: that is
indistinguishable from a stolen token being replayed, and it revokes the
family. If a refresh returns `invalid_grant`, discard everything and start
Path A over — the grant is gone, whether through reuse detection, expiry, or
a replayed authorization code.

**From an ID token.** It is for the client, not for an API — never send it
as a bearer token; `/userinfo` refuses it. Verify it, read `sub`, `name` and
`email` from it, and then it has done its job.

**From `invalid_client` at `/token`.** Check which method the client is
registered for. Presenting the right secret the wrong way is refused exactly
like the wrong secret.

**From here, to administer a tenant rather than act as a client of one.** [the
admin paths](../admin-paths/index.md) documents the admin API — the endpoints
under `/admin/tenants/{tenant}/` — separately from these pages, because it
serves an operator rather than an application integrator. [the console
paths](../console-paths/index.md) documents the console gateway under
`/console`, which signs an administrator in and forwards the console's calls to
that API.
