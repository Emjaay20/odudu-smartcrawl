---
title: 'Self-registration'
description: 'GET/POST /tenants/{tenant}/login-actions/registration is the first way a user reaches a tenant without an administrator seeding them in.'
---

# Self-registration

`GET`/`POST /tenants/{tenant}/login-actions/registration` is the first way a
user reaches a tenant without an administrator seeding them in. It answers
only when the tenant's `registration_allowed` is on — off by default, like
`verify_email` and `reset_password_allowed` — so a tenant serves nothing at
all here until an operator turns it on:

```bash
odudu seed \
  --tenant register-demo --client register-spa \
  --redirect-uri http://localhost:8080/callback
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://localhost:3000/tenants/register-demo/login-actions/registration
```

```
404
```

Both settings this flow needs are tenant settings, so one `seed tenant --set`
turns them on — repeatable, and applied in one statement:

```bash
odudu seed tenant --name register-demo \
  --set registration_allowed=true --set verify_email=true
```

```
{"command":"tenant","created":false,"tenant":"register-demo","tenantId":"01a0cb12-2131-78a5-9def-e9bcc032180b","settings":["registration_allowed","verify_email"]}
```

With both on, posting the form creates the account and, because
`verify_email` is on, sends a mail instead of leaving the address usable
right away:

```bash
curl -sS -X POST http://localhost:3000/tenants/register-demo/login-actions/registration \
  --data-urlencode 'username=ada' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=correct-horse-battery'
```

```
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Account created</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Account created</h1>
<p>Check your email for a link to verify your address before you can sign in.</p>
</main>
</body>
</html>
```

The subject, the `users` row, the password credential and the tenant's
default roles and groups — those `PUT /admin/tenants/{tenant}/roles/{id}/default`
and `PUT /admin/tenants/{tenant}/groups/{id}/default` mark, none of which may
reach an admin capability ([docs/admin-paths.md](../admin-api-paths/index.md)) — are all
created in one transaction, and the `verify_email`
token is issued inside that same transaction — the mail goes out only after
it commits, the same ordering [Address verification](./path-a-as-a-confidential-client.md#address-verification)
establishes. With `ODUDU_SMTP_HOST` unset, the link lands in the container's
log instead of an inbox:

```json
{
  "level": 30,
  "to": "ada@example.com",
  "subject": "Verify your register-demo account",
  "text": "Confirm your email address for ⁨register-demo⁩ by visiting this link:\n\nhttp://localhost:3000/tenants/register-demo/login-actions/action-token?key=Lab7hHM2wxtYPPCJKwlr-DLWD_Agyfk3A998qLQtaHo\n\nIf you did not request this, you can ignore this message.\n\n--\nYou received this because this email address was used to create or update an account at ⁨register-demo⁩.\n© 2026 Odudu · Powered by odudu",
  "htmlBytes": 5893,
  "msg": "captured email — no SMTP host configured"
}
```

(Captured on the project `odudu-p4g-mail` the section above names, so its key is that run's, not the one the commands below follow.)

A username holding a bidirectional control character, one that would reorder
the text around it wherever it is shown (U+202A to U+202E or U+2066 to U+2069),
is refused on its own sentence and nothing is created, the form's other fields
being as valid as they were. It is refused rather than stripped, because
stripping would let two different usernames collide. Captured on the project
`odudu-p4g-17`, port `3197`, posting `ada` followed by U+202E:

```bash
curl -sS -D - -X POST http://localhost:3197/tenants/register-demo/login-actions/registration \
  --data-urlencode "username=$(printf 'ada\xe2\x80\xae')" \
  --data-urlencode 'email=grace@example.com' \
  --data-urlencode 'password=correct-horse-battery'
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a152e1-d4aa-7c81-84d1-edb5e5da5b71
content-type: text/html
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 833
Date: Mon, 19 Oct 2026 06:38:14 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>That username contains a character that changes the direction of text, which is not allowed.</li>
</ul>
</main>
</body>
</html>
```

The same refusal holds for every other door: the admin API's field error carries
the code `bidi_control_refused` ([POST /subjects](../admin-api-paths/post-subjects.md#post-subjects)),
and `odudu seed` prints one line, `error: username must not contain
bidirectional control characters (U+202A to U+202E, U+2066 to U+2069)`, and exits
with status 1, naming the field it refused. Arabic and Hebrew usernames, with or without LRM and
RLM, are accepted: `odudu seed user --username مستخدم` created the account on
the same stack.

That link's host, `localhost:3000`, comes from `ODUDU_PUBLIC_BASE_URL`
(`compose.yaml` sets it to match the port published above) — never from the
request that reached the registration endpoint. A request's `Host` header
is client-controlled, and building a mailed link from it would let an
attacker who registers someone else's address choose where that link
points, capture the key when the victim (or a spam filter, or a link
preview) follows it, and verify an address they do not control against an
account they hold the password to. Posting the same form again with a
forged `Host` proves the header is ignored:

```bash
curl -sS -X POST http://localhost:3000/tenants/register-demo/login-actions/registration \
  -H 'Host: evil.example' \
  --data-urlencode 'username=grace' \
  --data-urlencode 'email=grace@example.com' \
  --data-urlencode 'password=correct-horse-battery'
```

```json
{
  "level": 30,
  "to": "grace@example.com",
  "subject": "Verify your register-demo account",
  "text": "Confirm your email address for ⁨register-demo⁩ by visiting this link:\n\nhttp://localhost:3000/tenants/register-demo/login-actions/action-token?key=6f5ULPUsXns2PQdyunW7qE0ArIa-yhBGsjVQg4DPNOA\n\nIf you did not request this, you can ignore this message.\n\n--\nYou received this because this email address was used to create or update an account at ⁨register-demo⁩.\n© 2026 Odudu · Powered by odudu",
  "htmlBytes": 5893,
  "msg": "captured email — no SMTP host configured"
}
```

Still `localhost:3000`, never `evil.example`. When `ODUDU_PUBLIC_BASE_URL`
is unset and a tenant's `verify_email` is on, registration refuses outright
(500, logged as a misconfiguration) rather than falling back to the
request in any way.

**This is the property the whole account-lifecycle build exists for**: an
unverified self-registered address must not be able to complete a login, and
the assertion is that no code is issued, not that a page says something.
Requesting `/authorize` and submitting the login form with the password just
set answers 200, not the usual 302:

```bash
AUTH_SESSION_ID=$(curl -sS --get \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'client_id=register-spa' \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'scope=openid email' \
  --data-urlencode 'state=xyz123' \
  --data-urlencode 'nonce=abc123' \
  --data-urlencode 'code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' \
  --data-urlencode 'code_challenge_method=S256' \
  'http://localhost:3000/tenants/register-demo/protocol/openid-connect/auth' \
  | sed -n '/name="auth_session_id"/{s/.*value="\([^"]*\)".*/\1/p;q;}')

curl -sS -i -X POST http://localhost:3000/tenants/register-demo/login-actions/authenticate \
  --data-urlencode "auth_session_id=$AUTH_SESSION_ID" \
  --data-urlencode 'username=ada' \
  --data-urlencode 'password=correct-horse-battery'
```

```
HTTP/1.1 200 OK
content-type: text/html

<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Verify your email</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t sign in yet</h1>
<p>You need to verify your email address before you can sign in. We sent a link to the address on this account — follow it, then sign in again.</p>
</main>
</body>
</html>
```

No `location` and no `set-cookie` header are on that response — nothing was
established and nothing was issued, which is the part a passing status code
alone could not prove. Following the mailed link, the same login now
completes:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://localhost:3000/tenants/register-demo/login-actions/action-token?key=6AkQjYEkoqMGiYpFx63UGAuvitBIEjmNyDMd6w2uN2Y'
```

```
200
```

```bash
AUTH_SESSION_ID=$(curl -sS --get \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'client_id=register-spa' \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'scope=openid email' \
  --data-urlencode 'state=xyz123' \
  --data-urlencode 'nonce=abc123' \
  --data-urlencode 'code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' \
  --data-urlencode 'code_challenge_method=S256' \
  'http://localhost:3000/tenants/register-demo/protocol/openid-connect/auth' \
  | sed -n '/name="auth_session_id"/{s/.*value="\([^"]*\)".*/\1/p;q;}')

curl -sS -i -X POST http://localhost:3000/tenants/register-demo/login-actions/authenticate \
  --data-urlencode "auth_session_id=$AUTH_SESSION_ID" \
  --data-urlencode 'username=ada' \
  --data-urlencode 'password=correct-horse-battery'
```

```
HTTP/1.1 302 Found
set-cookie: register-demo-session=01a0cb12-b62e-…; HttpOnly; SameSite=Lax; Path=/
set-cookie: register-demo-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
location: http://localhost:8080/callback?code=8DR6gZGbEKhkDcC7a0dilL9k2gDcZjHo8ZMOuZ6mnqM&state=xyz123&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Fregister-demo
```

(Captured before the session cookie carried a secret, so the cookie shown
is a truncated bare id; it is now `<session id>:<secret>`.)

`users.email` is unique per tenant, not globally — `email` alone would be a
tenancy bug — so a second registration for an address already held **in
this tenant** is refused:

```bash
curl -sS -X POST http://localhost:3000/tenants/register-demo/login-actions/registration \
  --data-urlencode 'username=carol' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=another-password'
```

```
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>That email address is already registered.</li>
</ul>
</main>
</body>
</html>
```

(400; the same address remains free to register again in a different tenant,
since the uniqueness `packages/db/drizzle/0023_users_email_unique.sql` adds
is `(tenant_id, email)`, not `email` alone.) A duplicate **username** and a
malformed address are both refused the same way — 400, with a message
naming which — rather than an unhandled error.

Every tenant also carries a password policy, and registration is one of its
writers. The default policy only floors the length at 8, so a short
password is refused with every violation the candidate has, not just the
first:

```bash
curl -sS -X POST http://localhost:3000/tenants/register-demo/login-actions/registration \
  --data-urlencode 'username=ada' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=short'
```

```
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>Password must be at least 8 characters long.</li>
</ul>
</main>
</body>
</html>
```

With `password_require_digit` and `password_require_uppercase` also turned
on for the tenant — `odudu seed tenant --name register-demo --set
password_require_digit=true --set password_require_uppercase=true` — the
same short password now lists all three:

```
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>Password must be at least 8 characters long.</li>
<li>Password must contain a digit.</li>
<li>Password must contain an uppercase letter.</li>
</ul>
</main>
</body>
</html>
```

The two rules above are turned off again before the transcripts below —
`--set password_require_digit=false --set password_require_uppercase=false`
— since a policy left on adds "Password must contain a digit." to every
list that follows and obscures the rule each one is actually about.

`password_not_username` and `password_not_email` (both on by default)
refuse a password containing the account's own username, or the local part
of its email address, case-insensitively — matched independently, so a
password tripping both lists both:

```bash
curl -sS -X POST http://localhost:3000/tenants/register-demo/login-actions/registration \
  --data-urlencode 'username=ada' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=myADApassword'
```

```
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>Password must not contain the username.</li>
<li>Password must not contain the email address.</li>
</ul>
</main>
</body>
</html>
```

A username and an email local part that differ show each rule on its own —
here `carol`'s password contains no part of her own username, but does
contain the local part of the email address given for the account:

```bash
curl -sS -X POST http://localhost:3000/tenants/register-demo/login-actions/registration \
  --data-urlencode 'username=carol' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=myADApassword'
```

```
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>Password must not contain the email address.</li>
</ul>
</main>
</body>
</html>
```

400 in every case above; no subject, user row or credential is created.

A tenant with `verify_email` off skips the mail and the gate above entirely:
the account created is usable at the next login, the same way a
seeded user always has been.

## What registration and verification leave in the audit log

A created account writes one `credential` row, `account.registered`, in the
transaction that creates it, and a redeemed verification link writes
`email.verified` in the transaction that consumes it. A refusal writes
neither: a taken address is a form error, and a spent link names nobody the
caller has proved anything about. This ran against its own tenant,
`signup-audit`, created by the two seed commands below, so the account and
the mailed link are the only ones in play. Every request carries an
`x-request-id` starting `signup-audit-`, and the query below reads back
exactly those.

The second registration differs from the first only in its username, so the
address is the only thing that can refuse it:

```bash
odudu seed --tenant signup-audit --client signup-audit-spa \
  --redirect-uri http://localhost:8080/callback
odudu seed tenant --name signup-audit \
  --set registration_allowed=true --set verify_email=true

curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:3000/tenants/signup-audit/login-actions/registration \
  -H 'x-request-id: signup-audit-ada' \
  --data-urlencode 'username=ada' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=correct-horse-battery'
curl -sS -w '\n%{http_code}\n' \
  -X POST http://localhost:3000/tenants/signup-audit/login-actions/registration \
  -H 'x-request-id: signup-audit-duplicate' \
  --data-urlencode 'username=carol' \
  --data-urlencode 'email=ada@example.com' \
  --data-urlencode 'password=correct-horse-battery'
```

```
{"created":true,"tenant":"signup-audit","tenantId":"01a0dc5e-9596-7fe2-903f-e72fe1e10817","clientId":"signup-audit-spa"}
{"command":"tenant","created":false,"tenant":"signup-audit","tenantId":"01a0dc5e-9596-7fe2-903f-e72fe1e10817","settings":["registration_allowed","verify_email"]}
201
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Can&#39;t create this account</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Can&#39;t create this account</h1>
<ul>
<li>That email address is already registered.</li>
</ul>
</main>
</body>
</html>
400
```

The key is read out of the verification mail the first registration queued,
which is the only message `signup-audit` has. The link is then followed
twice; the second time it is already spent:

```bash
docker compose exec -T postgres psql -U odudu -d odudu -At -c \
  "select substring(o.body_text from 'key=([A-Za-z0-9_-]+)')
     from email_outbox o join tenants t on t.id = o.tenant_id
    where t.name = 'signup-audit';"
```

```
TDknXMNC-qv54W-FspVCC7cVDcnmyUJP_AJQL_us3sU
```

```bash
KEY=TDknXMNC-qv54W-FspVCC7cVDcnmyUJP_AJQL_us3sU
curl -sS -o /dev/null -w '%{http_code}\n' -H 'x-request-id: signup-audit-verify' \
  "http://localhost:3000/tenants/signup-audit/login-actions/action-token?key=$KEY"
curl -sS -o /dev/null -w '%{http_code}\n' -H 'x-request-id: signup-audit-replay' \
  "http://localhost:3000/tenants/signup-audit/login-actions/action-token?key=$KEY"

docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
  "select e.request_id, e.event_type, e.action, e.outcome, e.actor_subject_id,
          e.resource_type, e.resource_id, e.detail
     from audit_events e
    where e.request_id like 'signup-audit-%'
    order by e.occurred_at;"
```

```
200
400
-[ RECORD 1 ]----+-------------------------------------
request_id       | signup-audit-ada
event_type       | credential
action           | account.registered
outcome          | allowed
actor_subject_id | 01a0dc5e-97dc-7029-a57e-bf0089130db1
resource_type    | subject
resource_id      | 01a0dc5e-97dc-7029-a57e-bf0089130db1
detail           | {}
-[ RECORD 2 ]----+-------------------------------------
request_id       | signup-audit-verify
event_type       | credential
action           | email.verified
outcome          | allowed
actor_subject_id | 01a0dc5e-97dc-7029-a57e-bf0089130db1
resource_type    | subject
resource_id      | 01a0dc5e-97dc-7029-a57e-bf0089130db1
detail           | {}
```

Four requests, two rows: none for the duplicate address and none for the
replayed link. `01a0dc5e-97dc-…` is the `users.subject_id` this stack holds
for `ada` in `signup-audit`. `detail` is empty on every `credential` row —
no password, address or key is written to one, and the action names what
happened.
