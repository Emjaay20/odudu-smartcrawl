---
title: 'GET /subjects/:id/lockout'
description: "Requires view-users. The subject's run of failed sign-ins as the lockout reads it: failure_count, last_failure_at, locked_until, and locked —…"
---

# `GET /subjects/:id/lockout`

Requires `view-users`. The subject's run of failed sign-ins as the lockout reads
it: `failure_count`, `last_failure_at`, `locked_until`, and `locked` — whether
an attempt made now would be refused, judged by the server's clock so a caller
never compares `locked_until` against its own. A lock that has run out answers
`locked: false` with its count kept, since the run is only forgotten after
`brute_force_failure_reset_seconds` of quiet ([the
README](https://github.com/wizzywit/odudu/blob/main/README.md)'s brute-force
section has the arithmetic). A subject that has never failed answers a zero
count and nulls. An unknown subject, one in another tenant, or one with no
`users` row answers `404`.

Described at the top of this page, in a tenant `lockout-demo` made by `odudu
seed --tenant lockout-demo --client lockout-demo-app --redirect-uri
https://app.example/callback --user hana`, on `ines`, a second subject seeded
there with `odudu seed user` and signed in by nothing before this. `signin` is
the helper the section below defines, pointed at this tenant, this client,
`ines` and port 3080 — as run:

```bash
AUTHORIZE='http://localhost:3080/tenants/lockout-demo/protocol/openid-connect/auth?response_type=code&client_id=lockout-demo-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid&state=xyz&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
signin() {
  sid=$(curl -sS "$AUTHORIZE" | sed -n 's/.*name="auth_session_id" value="\([^"]*\)".*/\1/p' | head -1)
  curl -sS -D - -o body.html \
    --data-urlencode "auth_session_id=$sid" \
    --data-urlencode "username=ines" \
    --data-urlencode "password=$1" \
    http://localhost:3080/tenants/lockout-demo/login-actions/authenticate | grep -iE '^(HTTP|location)'
  grep -o '<title>[^<]*</title>' body.html || true
}
```

Read first, then five wrong passwords and the right one — all six refused,
the sixth for the lock — then read again:

```bash
INES=http://localhost:3080/admin/tenants/lockout-demo/subjects/01a0ec85-0c4c-7ab4-821c-a4fad1d15482
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$INES/lockout"
for attempt in 1 2 3 4 5; do signin 'not the password'; done
signin 'correct horse battery staple'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$INES/lockout"
```

```
{"locked":false,"locked_until":null,"failure_count":0,"last_failure_at":null}
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
{"locked":true,"locked_until":"2026-09-29T09:37:48.522Z","failure_count":6,"last_failure_at":"2026-09-29T09:35:48.522Z"}
```

The sixth attempt counted too, so the lock is the doubled one, two minutes.
Clearing it, reading again, then an id no user subject in `lockout-demo`
holds — the tenant's own id:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$INES/lockout"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$INES/lockout"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3080/admin/tenants/lockout-demo/subjects/01a0ec84-9897-7740-a17f-83b4de29cdda/lockout
```

```
HTTP/1.1 204 No Content
x-request-id: 01a0ec85-3777-7b4c-bbd6-5aed404a90af
cache-control: no-store
Date: Tue, 29 Sep 2026 09:35:48 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"locked":false,"locked_until":null,"failure_count":0,"last_failure_at":null}
{"type":"about:blank","title":"Not Found","status":404,"detail":"no user subject 01a0ec84-9897-7740-a17f-83b4de29cdda","instance":"01a0ec85-37a5-7747-b4ff-2114cc1f7d80"}
```
