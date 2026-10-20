---
title: 'GET /console/auth/callback, restarted'
description: 'From the fifth run, recaptured on its own stack after the page headers changed: the infra/docker compose file as the project odudu-17a, on…'
---

# `GET /console/auth/callback`, restarted

From **the fifth run**, recaptured on its own stack after the page headers
changed: the `infra/docker` compose file as the project `odudu-17a`, on
`http://localhost:3094`, built from commit `a29df187`, with a throwaway tenant,
`signin-restart`, holding `grace` as its administrator. A curl cookie jar,
`jar`, plays one browser throughout. With `COMPOSE_PROJECT_NAME=odudu-17a` set,
the seed printed:

```bash
docker compose exec -T odudu node dist/main.js seed tenant --name signin-restart
docker compose exec -T odudu node dist/main.js seed user --tenant signin-restart \
  --username grace --password signin-restart-throwaway
docker compose exec -T odudu node dist/main.js seed grant-role --tenant signin-restart \
  --username grace --role odudu-admin:tenant-admin
```

```
{"command":"tenant","created":true,"tenant":"signin-restart","tenantId":"01a137d9-2d02-79dd-8cc3-1a6be901dd66"}
{"command":"user","tenant":"signin-restart","tenantId":"01a137d9-2d02-79dd-8cc3-1a6be901dd66","username":"grace","userSubjectId":"01a137d9-2f67-79d3-a4b5-260429cfb2f5"}
{"command":"grant-role","tenant":"signin-restart","tenantId":"01a137d9-2d02-79dd-8cc3-1a6be901dd66","username":"grace","role":"odudu-admin:tenant-admin"}
```

A refused callback no longer ends on the refusal page. It begins the
sign-in again, once, for the tenant its `state` is bound to, with a fresh
`state` of its own. The answer is the same whichever check refused, so it
says nothing about which one failed, and the code it carried is never
presented. A refusal that arrives while that restart's `odudu-console-restart`
cookie is still set (60 seconds) is shown the page instead, and the page links
back to the console.

The tenant is read from the `state` alone, which nothing authenticates:
anyone can write `<uuid>.<43 characters>`, so the restart's `location` names
the tenant for any tenant uuid it is given. That is accepted. A tenant's name
is public in every `/tenants/<name>/` URL, its uuid already travels in its
own `state` and session cookie, and the `location` only ever leads to this
gateway's own `/console/auth/login`. Without the name, an expired sign-in
could restart only at `/console/`, and would lose the silent sign-in shown
below.

**A sign-in left open past the login's lifetime.** The gateway's `login`, the
tenant's authorization endpoint and `grace`'s password were sent as in
[the first run](./get-consoleauthlogin.md). The `authenticate` request answered:

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-323f-701b-9976-58bd40d69fd7
set-cookie: signin-restart-session=01a137d9-327e-74f5-b9c4-9aa6f9537379:bRK7iKttBUtx8HZ1Kjnt5FdU2SGoZylmigDvP8IjFTY; HttpOnly; SameSite=Lax; Path=/
set-cookie: signin-restart-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
location: http://localhost:3094/console/auth/callback?code=BXacagqY6CAjMnO7etFB2K3fuZy4F4ULAjTotCQOdic&state=01a137d9-2d02-79dd-8cc3-1a6be901dd66.vPwlNUm8H2YLbScw01ghWr1JlmNRUo92LvqBrl43OUo&iss=http%3A%2F%2Flocalhost%3A3094%2Ftenants%2Fsignin-restart
content-length: 0
Date: Wed, 14 Oct 2026 00:39:03 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The pending sign-in lasts 1800 seconds, in its row and in the login cookie's
`Max-Age`, as [`GET /console/auth/login`](./get-consoleauthlogin.md) shows. The row was expired with `psql` (header spaces trimmed, as above),
and the jar's login cookie was removed, as a browser drops it at its
`Max-Age`:

```sql
update console_logins set expires_at = now() - interval '1 second'
  where tenant_id = '01a137d9-2d02-79dd-8cc3-1a6be901dd66';
select expires_at < now() as expired from console_logins
  where tenant_id = '01a137d9-2d02-79dd-8cc3-1a6be901dd66';
```

```
UPDATE 1
 expired
---------
 t
(1 row)
```

The callback the tenant redirected to, `$LOCATION` being its `location`:

```bash
curl -sS -D - -c jar -b jar "$LOCATION"
```

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-3392-7846-a9c9-078dc611111e
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=60
location: /console/auth/login?tenant=signin-restart
content-length: 0
Date: Wed, 14 Oct 2026 00:39:03 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

**The same callback again, inside the minute.** The jar now holds
`odudu-console-restart`, so the refusal is shown rather than restarted:

```bash
curl -sS -D - -c jar -b jar "$LOCATION"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a137d9-33ca-741c-a265-6987b59da4cc
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
content-type: text/html; charset=utf-8
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 778
Date: Wed, 14 Oct 2026 00:39:03 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Sign-in failed</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Sign-in failed</h1>
<p>The sign-in could not be completed.</p>
<p><a href="/console/">Sign in again</a></p>
</main>
</body>
</html>
```

**Following the restart.** The tenant's own session, set by the stale
sign-in, answers the fresh authorization request at once:

```bash
curl -sS -D - -o /dev/null -c jar -b jar 'http://localhost:3094/console/auth/login?tenant=signin-restart'
curl -sS -D - -o /dev/null -c jar -b jar "$AUTHORIZE"   # the location above
curl -sS -D - -o /dev/null -c jar -b jar "$CALLBACK"    # the location above
```

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-3401-75da-8002-a1f21c9696b4
cache-control: no-store
set-cookie: odudu-console-login=01a137d9-2d02-79dd-8cc3-1a6be901dd66.786lRcFN_23xvOSlSBpLNnSlkxH23JcXlFMcidbeb98; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800
location: http://localhost:3094/tenants/signin-restart/protocol/openid-connect/auth?response_type=code&client_id=odudu-admin&redirect_uri=http%3A%2F%2Flocalhost%3A3094%2Fconsole%2Fauth%2Fcallback&scope=openid&resource=urn%3Aodudu%3Aparams%3Aadmin-api&state=01a137d9-2d02-79dd-8cc3-1a6be901dd66.786lRcFN_23xvOSlSBpLNnSlkxH23JcXlFMcidbeb98&nonce=MVvlp9wVPojap_B06wQ2xOWBQ5anWnoEFAhOzEfkyeI&code_challenge=4yoHDzPh9jGSZsWVU2ItMbtWUscZ-LAlFZdU_klX6r8&code_challenge_method=S256
content-length: 0
Date: Wed, 14 Oct 2026 00:39:03 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-3436-725b-9a42-a372220ed518
location: http://localhost:3094/console/auth/callback?code=RYeME438Vbb_YoQRCyEbFFa7aKUP_htsR1-fafuDY4Y&state=01a137d9-2d02-79dd-8cc3-1a6be901dd66.786lRcFN_23xvOSlSBpLNnSlkxH23JcXlFMcidbeb98&iss=http%3A%2F%2Flocalhost%3A3094%2Ftenants%2Fsignin-restart
content-length: 0
Date: Wed, 14 Oct 2026 00:39:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-347c-71fe-a228-2eb9fe4c4a9f
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console=01a137d9-2d02-79dd-8cc3-1a6be901dd66.lzx9xHY3oaylM0X7DAPdt2TyiDcmVovaxZM5MC9OGhg; HttpOnly; SameSite=Strict; Path=/
location: /console/
content-length: 0
Date: Wed, 14 Oct 2026 00:39:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The sign-in completed, and the restart cookie was cleared with the login
cookie. The code the stale callback carried, `BXacagqY6CAjMnO7etFB2K3fuZy4F4ULAjTotCQOdic`, was never
exchanged. The tenant's codes afterwards, each named by matching its stored
hash (base64url SHA-256) against the two codes above:

```sql
select case code_hash
    when translate(rtrim(encode(sha256(convert_to('BXacagqY6CAjMnO7etFB2K3fuZy4F4ULAjTotCQOdic', 'UTF8')), 'base64'), '='), '+/', '-_') then 'stale'
    when translate(rtrim(encode(sha256(convert_to('RYeME438Vbb_YoQRCyEbFFa7aKUP_htsR1-fafuDY4Y', 'UTF8')), 'base64'), '='), '+/', '-_') then 'restart'
  end as code, consumed_at is not null as consumed
  from authorization_codes where tenant_id = '01a137d9-2d02-79dd-8cc3-1a6be901dd66' order by 1;
```

```
  code   | consumed
---------+----------
 restart | t
 stale   | f
(2 rows)
```

**A `state` that does not match the login cookie.** A new jar, `jar2`, began
a sign-in, which set:

```
set-cookie: odudu-console-login=01a137d9-2d02-79dd-8cc3-1a6be901dd66.N75MBBsyUzK5CfGtyNHo_tHQ7weQGs69XkC6sdqrn5c; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800
```

A callback whose `state` keeps that tenant and carries another secret of the
same shape is answered exactly as the expired one was:

```bash
curl -sS -D - -c jar2 -b jar2 'http://localhost:3094/console/auth/callback?code=anything&state=01a137d9-2d02-79dd-8cc3-1a6be901dd66.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&iss=http%3A%2F%2Flocalhost%3A3094%2Ftenants%2Fsignin-restart'
```

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-35b3-7b21-a6fa-75e681e8efa2
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=60
location: /console/auth/login?tenant=signin-restart
content-length: 0
Date: Wed, 14 Oct 2026 00:39:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

A `state` that names no tenant the gateway can read restarts at the
console's own `/console/` instead:

```bash
curl -sS -D - 'http://localhost:3094/console/auth/callback?code=anything&state=not-a-state&iss=http%3A%2F%2Flocalhost%3A3094%2Ftenants%2Fsignin-restart'
```

```
HTTP/1.1 302 Found
x-request-id: 01a137d9-35eb-7c50-87eb-f0d82b2aec3e
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=60
location: /console/
content-length: 0
Date: Wed, 14 Oct 2026 00:39:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

A callback with no `state` at all, which no sign-in of this console's
produces, is shown the page at once, with no restart cookie:

```bash
curl -sS -D - 'http://localhost:3094/console/auth/callback?code=anything&iss=http%3A%2F%2Flocalhost%3A3094%2Ftenants%2Fsignin-restart'
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a137d9-3620-717a-904f-4af8a603f810
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
content-type: text/html; charset=utf-8
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 778
Date: Wed, 14 Oct 2026 00:39:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Sign-in failed</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="16" cy="8" r="5"/><path d="M16 13v16"/></svg><span class="wordmark">odudu</span></p>
<h1>Sign-in failed</h1>
<p>The sign-in could not be completed.</p>
<p><a href="/console/">Sign in again</a></p>
</main>
</body>
</html>
```
