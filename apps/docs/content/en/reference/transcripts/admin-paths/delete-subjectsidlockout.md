---
title: 'DELETE /subjects/:id/lockout'
description: "Requires manage-users. Deletes the subject's login_failures row — the same write a correct password accepted by an unlocked account makes — so the…"
---

# `DELETE /subjects/:id/lockout`

Requires `manage-users`. Deletes the subject's `login_failures` row — the
same write a correct password accepted by an unlocked account makes — so
the lockout ends and the run of failures behind it with it: the next wrong
password counts from one. It answers `204` whether or not anything was
recorded against the subject, since "nothing against it" is the state the
call exists to reach, and its `subject.lockout_clear` audit row says which
it was in `detail.cleared`. An unknown subject, one in another tenant, or a
subject with no `users` row — a service or `agent_instance` subject, which
has no sign-in to be locked out of — answers `404`.

A locked account refuses its right password with the same sign-in page a wrong
one gets ([the brute-force lockout](../request-paths/brute-force-lockout.md)), so the run below shows the
lock by submitting the right password last. `signin` is a helper defined for
these runs: a fresh `/authorize` against `recovery-demo-app`, a confidential
client created for them with `https://app.example/callback` registered, then one
password submission as `hana`, printing the status, any `location`, and the
page's title.

```bash
AUTHORIZE='http://localhost:3000/tenants/recovery-demo/protocol/openid-connect/auth?response_type=code&client_id=recovery-demo-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid&state=xyz&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
signin() {
  sid=$(curl -sS "$AUTHORIZE" | sed -n 's/.*name="auth_session_id" value="\([^"]*\)".*/\1/p' | head -1)
  curl -sS -D - -o body.html \
    --data-urlencode "auth_session_id=$sid" \
    --data-urlencode "username=hana" \
    --data-urlencode "password=$1" \
    http://localhost:3000/tenants/recovery-demo/login-actions/authenticate | grep -iE '^(HTTP|location)'
  grep -o '<title>[^<]*</title>' body.html || true
}

for attempt in 1 2 3 4 5; do signin 'not the password'; done
signin 'correct horse battery staple'
```

Five wrong passwords, then the right one, refused the same way:

```
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
```

Clearing it, then the right password — a code, at once, with no wait —
then a second sign-in, which the section on ending every session below
uses:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/recovery-demo/subjects/01a0e303-9db3-712d-9272-98d2c2a04320/lockout
signin 'correct horse battery staple'

signin 'correct horse battery staple'
```

```
HTTP/1.1 204 No Content
x-request-id: 01a0e304-78e0-7003-90f4-53ed807b3fd4
cache-control: no-store
Date: Sun, 27 Sep 2026 13:18:36 GMT
Connection: keep-alive
Keep-Alive: timeout=72

HTTP/1.1 302 Found
location: https://app.example/callback?code=h09v7JRpqx_2QP43pO0iFb-Mi_-y5-uvQ_dLO9R1yEM&state=xyz&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Frecovery-demo
HTTP/1.1 302 Found
location: https://app.example/callback?code=dIaPGsUTiYp47Ypkl8FuoxachQAgewGPjxhS7Uy0nT4&state=xyz&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Frecovery-demo
```
