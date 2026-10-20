---
title: 'Path A, as a confidential client'
description: 'Path A ran demo-spa, which is public. The other common deployment shape is a server-side web application that holds a secret, and a reader who is…'
---

# Path A, as a confidential client

Path A ran `demo-spa`, which is public. The other common deployment shape is
a server-side web application that holds a secret, and a reader who is
building one needs to see it walked rather than inferred.

It is the same journey. Discovery, `/authorize`, the login POST and
`/userinfo` are what Path A showed, with `client_id=demo-backend` in place of
`demo-spa` and nothing else changed — the same PKCE pair, the same login
form, the same authorization code. One hop differs: at `/token` the client
authenticates, in the one way it is registered for.

## PKCE is not a public-client concern here

A reader arriving from another provider will expect `code_challenge` to be
optional for a client that has a secret, and will leave it out. Most
providers make it a per-client setting; RFC 7636 introduced it for clients
that cannot keep a secret, and OpenID Connect Core does not ask for it at
all.

Odudu requires it of every client on every `authorization_code` request,
with no exception and no per-client opt-out, following OAuth 2.1
(`draft-ietf-oauth-v2-1-15` §4.1.1). That is not a small divergence: it is
the entire reason the OpenID Foundation's Basic OP certification plan cannot
pass here. Every module of that plan but its one dedicated PKCE module sends
an authorization request carrying no `code_challenge`, and Odudu refuses each
one — 28 of 35 modules, each failure individually confirmed to be this and
nothing else. [ADR 0016](https://github.com/wizzywit/odudu/blob/main/docs/adr/0016-mandatory-pkce-over-basic-op.md) records
the decision and what was given up for it.

Omitting the challenge does not fall back to proving yourself with the
secret instead. The request is refused at `/authorize`, before a secret
would ever be presented:

```bash
curl -sS -D - -o /dev/null --get \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'client_id=demo-backend' \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'scope=openid profile email' \
  --data-urlencode 'state=xyz-123' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/auth'
```

```
HTTP/1.1 302 Found
location: http://localhost:8080/callback?error=invalid_request&state=xyz-123&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Fdemo
content-length: 0
```

The refusal travels back to the client as a redirect rather than a rendered
page because `client_id` and `redirect_uri` were both good — the boundary is
in [`/authorize`: the render-versus-redirect boundary](./the-branches.md#authorize-the-render-versus-redirect-boundary).
`state` comes back so the client can match the answer to its request, and
`iss` (RFC 9207) so it can tell which issuer refused.

## Redeeming the code with `client_secret_basic`

`demo-backend` is registered for `client_secret_basic`, so the secret goes in
the `Authorization` header. `curl -u` builds it. There is no `client_id`
parameter: the header already names the client.

```bash
curl -sS -D - -u demo-backend:demo-backend-secret \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode "code_verifier=$VERIFIER" \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```
HTTP/1.1 200 OK
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8

{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "id_token": "eyJhbGciOiJSUzI1NiIs…",
  "refresh_token": "QBt3F9bUdMxbNZIQF3MD…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid profile email"
}
```

(All three token values truncated.) `$CODE` and `$VERIFIER` are the ones
[The shell variables the rest of this document uses](./bootstrap.md#the-shell-variables-the-rest-of-this-document-uses)
produces, with `client_id=demo-backend` substituted in the first two blocks.

The response is Path A's response, and so are the tokens inside it, except
where they name the client:

```json
{
  "iss": "http://localhost:3000/tenants/demo",
  "sub": "01a0cb07-4e76-…",
  "aud": ["http://localhost:3000/tenants/demo"],
  "client_id": "demo-backend",
  "scope": "openid profile email",
  "iat": 1790113245,
  "exp": 1790113545,
  "jti": "01a0cb10-6aed-…",
  "sid": "01a0cb10-6ab6-…",
  "grant_id": "01a0cb10-6aed-7396-b2e0-2383f0bb527a"
}
```

```json
{
  "sub": "01a0cb07-4e76-…",
  "name": "ada",
  "preferred_username": "ada",
  "email": "ada@example.com",
  "email_verified": false,
  "iss": "http://localhost:3000/tenants/demo",
  "aud": "demo-backend",
  "iat": 1790113245,
  "exp": 1790113545,
  "nonce": "n-0S6_WzA2Mj",
  "sid": "01a0cb10-6ab6-…",
  "amr": ["pwd"],
  "acr": "1"
}
```

(`sub`, `kid` and `jti` shortened; the headers are as Path A's.) `sub` is
ada's, the same identifier `demo-spa` was given for her — a subject belongs
to the tenant, not to the client that asked. The service-account subject a
confidential client also carries is a different one, and only
[`client_credentials`](./path-c-client_credentials.md) mints tokens for it.

**A refresh token, unlike `client_credentials`.** A user authenticated here
and is not going to stay at the keyboard, which is the situation refresh
exists for; it rotates exactly as [Path B](./path-b-refresh-rotation.md)
describes, with the client authenticating on each refresh as it did here.

## The same redemption with `client_secret_post`

`demo-post` is registered for `client_secret_post`, so the same two values go
in the form body instead, and `client_id` is sent because nothing else names
the client:

```bash
curl -sS -D - \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'client_id=demo-post' \
  --data-urlencode 'client_secret=demo-post-secret' \
  --data-urlencode "code_verifier=$VERIFIER" \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```
HTTP/1.1 200 OK
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8

{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "id_token": "eyJhbGciOiJSUzI1NiIs…",
  "refresh_token": "vwguWAm5qJ2mPfXBBVhk…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid profile email"
}
```

(Truncated as above. The tokens differ from the block before only in naming
`demo-post`.)

Which of the two a client may use is registered, not chosen per request, and
sending the other is `invalid_client` even with the right secret — the matrix
is in
[Client authentication is by the registered method and no other](./the-branches.md#client-authentication-is-by-the-registered-method-and-no-other).

A third method, `private_key_jwt`, is registered by no client on this stack
— `seed client` cannot produce one, and the clients this document registers
dynamically all leave `token_endpoint_auth_method` at its default — so no
transcript for it appears here. `POST /admin/tenants/{tenant}/clients`
([Admin paths](../admin-paths/get-clients-post-clients-and-get-clientsid.md))
can produce one, and dynamic registration always could; see
[What is not implemented](https://github.com/wizzywit/odudu/blob/main/docs/request-paths.md#what-is-not-implemented)'s `seed client` row for
why this document does not, and the [`/token`](./the-branches.md#token) refusal table for
the bytes each of its failures answers with.

Presenting no secret at all is refused the same way. A confidential client
cannot redeem a code as though it were public, however good the code and the
verifier are:

```bash
curl -sS -D - \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'client_id=demo-backend' \
  --data-urlencode "code_verifier=$VERIFIER" \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```
HTTP/1.1 401 Unauthorized
www-authenticate: Basic realm="token"
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8

{"error":"invalid_client"}
```

**What the client does next:** what Path A's client does, with one
difference that matters operationally — the secret is held by the server, so
the access and refresh tokens never need to reach the browser at all. That
is the reason to be a confidential client.

## Address verification

`email_verified` is a stored claim, but until now nothing could set it
truthfully — every ID token and UserInfo response above for `ada` carries
`"email_verified": false`, and that is still real: nothing verifies an
address until this section. `GET /tenants/{tenant}/login-actions/action-token?key=…`
is the other half: consuming the link a verification email carries.
[Self-registration](./self-registration.md) below is one way to trigger that
mail, for an address that does not exist yet; `odudu seed
--send-verification-email` is the other, standing in for the admin
console's "Send verification email" action against a user who already
exists — `ada`, seeded back in [Bootstrap](./bootstrap.md). A tenant's `verify_email` is turned on
with `seed tenant --set`, the same way
[Self-registration](./self-registration.md) turns on the other two:

```bash
odudu seed tenant --name demo --set verify_email=true
```

```
{"command":"tenant","created":false,"tenant":"demo","tenantId":"01a0cb07-4e24-73d6-8060-137e69941e60","settings":["verify_email"]}
```

```bash
odudu seed \
  --tenant demo --client demo-spa \
  --redirect-uri http://localhost:8080/callback \
  --user ada --password correct-horse-battery --email ada@example.com \
  --send-verification-email
```

The command queues the message and returns; nothing is sent on its way out.
The stack's own mail pass picks it up within
`ODUDU_OUTBOX_INTERVAL_SECONDS` ([Sending queued mail](./sending-queued-mail-odudu-send-mail.md)),
so the capture below appears in `docker compose logs odudu` a moment later
rather than in the seed command's own output. And with `ODUDU_SMTP_HOST`
unset — true of the compose stack and of every way this document runs the
server — nothing is actually delivered either: `loggingSender` writes the
message it would have sent to the log and keeps nothing, which is how a
reader without a mail server gets the link:

```json
{
  "level": 30,
  "to": "ada@example.com",
  "subject": "Verify your demo account",
  "text": "Confirm your email address for ⁨demo⁩ by visiting this link:\n\nhttp://localhost:3000/tenants/demo/login-actions/action-token?key=F5EglJdZ3sw6QhoZJ-df2pm7R5NIFvub-AYg4HV6IBw\n\nIf you did not request this, you can ignore this message.\n\n--\nYou received this because this email address was used to create or update an account at ⁨demo⁩.\n© 2026 Odudu · Powered by odudu",
  "htmlBytes": 5839,
  "msg": "captured email — no SMTP host configured"
}
```

(One line of a larger pino JSON object, reduced to the fields that matter
here. The log carries the size of the `html` part in bytes, `htmlBytes`, and
never the markup: it is five kilobytes a message, and a log line is not the
place for it. The key is shortened nowhere else in this document because a
reader needs the whole thing to follow the link.)

The `html` part is a designed message, not bare markup: table-based and
560px wide, every style inline, the colours the console's own tokens compile
to, a light palette that stands alone and a dark one a `prefers-color-scheme`
block swaps in where the client reads it. It opens with a hidden line of
preview text for the inbox list, then carries the tenant's display name
(cut to eighty characters and an ellipsis if it is longer) beside the Odudu
mark (an inline image the SMTP sender attaches, named `cid:odudu-mark`, with
the word `odudu` as its alt text), a heading, the sentence, a button, the same
address written out under it, a muted line on why the message was sent, and a
footer whose year is the UTC year of the moment the message was written. The
button and the written-out address are the only two anchors in it, and both
carry the whole link. The stack sent the same message again through a relay,
a Mailpit container, and the command reads the anchors from what Mailpit
holds (`ID` is the message's id in Mailpit's list; its key is that send's, not
the one above):

```bash
curl -s "http://localhost:18925/api/v1/message/$ID" | jq -r .HTML | grep -o '<a [^>]*>[^<]*</a>'
```

```
<a class="m-button-link" href="http://localhost:3000/tenants/demo/login-actions/action-token?key=odhQGLAhhS7ff880f_mHki4G35TclDgeGPo0bSMMtos" target="_blank" style="display:inline-block;font:600 15px/20px system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;mso-line-height-rule:exactly">Verify email</a>
<a class="m-link" href="http://localhost:3000/tenants/demo/login-actions/action-token?key=odhQGLAhhS7ff880f_mHki4G35TclDgeGPo0bSMMtos" target="_blank" style="color:#0a6344;text-decoration:underline;word-break:break-all">http://localhost:3000/tenants/demo/login-actions/action-token?key=odhQGLAhhS7ff880f_mHki4G35TclDgeGPo0bSMMtos</a>
```

The plain-text part carries the link on a line of its own, then the same
reason line and footer after a `--` line. The mails as a mail client draws
them, in both palettes, at 600px and 375px, are in the
[mail gallery](https://github.com/wizzywit/odudu/blob/main/docs/phases/p4g.md#mail-gallery).

The text of every mail comes from the mail package's own message catalogue
(`en` today), in the language of the recipient's `locale` where the sender
knows it and in English otherwise. A tenant name is somebody else's text, so
the plain-text part wraps it in Unicode isolates (U+2068 before it and U+2069
after, invisible in most viewers but present in the captures on this page),
the HTML part in `<bdi>`, and the subject carries it with bidirectional
controls and line breaks removed, since a header can hold neither. The four
mail captures in this document were taken on 2026-10-19 from a live run of
the same three mails (`demo`, `register-demo` and `reset-demo`) on the compose
project `odudu-p4g-mail`, published on a port of its own with
`ODUDU_PUBLIC_BASE_URL` set to `http://localhost:3000` so the links read as
the rest of this document's do. Their keys are that run's, so the commands
below that follow a link follow the keys of the earlier run they were
captured against, not these.

Before following it, `ada`'s ID token still reads the way every one earlier
in this document does:

```json
{ "email": "ada@example.com", "email_verified": false }
```

Following the link once verifies it:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://localhost:3000/tenants/demo/login-actions/action-token?key=9qsTxZgVlA_N8dHLuijG5l7UUex8F4HwGJEanfGXYCk'
```

```
200
```

and a fresh ID token for `ada` now carries `"email_verified": true` —
nothing else about the token changes, since email and its verification
status are the only claims this touches:

```json
{ "email": "ada@example.com", "email_verified": true }
```

Following the same link again is refused — it was minted for one
redemption, and `action_tokens.consumed_at` is now set:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://localhost:3000/tenants/demo/login-actions/action-token?key=9qsTxZgVlA_N8dHLuijG5l7UUex8F4HwGJEanfGXYCk'
```

```
400
```

The same 400 answers a key that never existed, one presented to the wrong
tenant, one past its 12-hour lifespan, or one whose address the user has
since changed — consumption compares the token's stored `email` against the
user's current one and refuses on any mismatch, so a verification cannot
outlive the address it was proving. None of those four are told apart in
the response: the page a browser lands on has no way to use the difference,
and telling a prober "this exact key existed" is a smaller leak than it
looks, but not one worth taking for free.

`--send-verification-email` needs `--email`, and needs the named user to
already exist — seeded in this same run or a previous one — or the command
refuses with `seed_invalid_options` before touching the database.

Every `ada` token or UserInfo response captured **above** this section in
this document was captured before this run — that is why they read `false`
and this section's own capture reads `true`: the account whose Bootstrap
this document shares was verified here, not earlier.
