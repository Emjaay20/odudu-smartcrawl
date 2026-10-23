---
title: 'GET /console/auth/callback'
description: 'The console callback that takes the tenant sign-in redirect, ends the login cookie and starts the console session.'
---

# `GET /console/auth/callback`

`$LOCATION` is the `location` above.

```bash
curl -sS -D - -c jar -b jar "$LOCATION"
```

```
HTTP/1.1 302 Found
x-request-id: 01a0e72e-5420-7794-970f-f1cffaac46aa
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console=01a0e72d-5927-73c3-b14d-a5b60d1ca9ad.haC6Ej3Vxp88GHIxzZDnwLrUhG4kP5C4hl4Ieh7MZmo; HttpOnly; SameSite=Strict; Path=/
location: /console/x
content-length: 0
Date: Mon, 28 Sep 2026 08:42:48 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The callback checked the login cookie against `state`, took the pending
sign-in, compared `iss` with the tenant's discovered issuer, exchanged the
code, and verified the ID token and its nonce. It then cleared the login
cookie, set the session cookie and redirected to `return_to`. The session
cookie is `<tenant id>.<secret>` again, and only the secret's SHA-256 is
stored. The tokens stay in the `console_sessions` row, wrapped under the KEK,
and none of them reaches the browser.
