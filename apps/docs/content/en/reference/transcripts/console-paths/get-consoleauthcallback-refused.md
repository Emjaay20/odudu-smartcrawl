---
title: 'GET /console/auth/callback, refused'
description: 'A callback whose state does not match the login cookie restarts the sign-in once; a second refusal inside the minute shows a page that links back.'
---

# `GET /console/auth/callback`, refused

The sign-in and the refusals up to the authorization endpoint's error are from a
later run, once a first refusal began to answer a restart and the page began to
link back to the console; what follows them is from an earlier one. The sign-in
used the same `login`, authorization-endpoint and `authenticate` requests as the
first run. The two that set what this section uses answered:

```
HTTP/1.1 302 Found
x-request-id: 01a151e5-bc67-7333-a276-d5551c619ef2
cache-control: no-store
set-cookie: odudu-console-login=01a151e5-47f9-7b63-89ae-c0fb10717b4e.mM_2h-bfxFFbQPBrr-6XKbSIDUdO7z9XyDcttPZRtAc; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800
location: http://localhost:3513/tenants/console-paths/protocol/openid-connect/auth?response_type=code&client_id=odudu-admin&redirect_uri=http%3A%2F%2Flocalhost%3A3513%2Fconsole%2Fauth%2Fcallback&scope=openid&resource=urn%3Aodudu%3Aparams%3Aadmin-api&state=01a151e5-47f9-7b63-89ae-c0fb10717b4e.mM_2h-bfxFFbQPBrr-6XKbSIDUdO7z9XyDcttPZRtAc&nonce=mE6UWAPtLY9HCx9jhf9UauwWLCkh6jVL-koeoSapuRM&code_challenge=u3cYJ2-YRaWlxAIy7G34CnB4kShE9FdLppvTveodzA0&code_challenge_method=S256
content-length: 0
Date: Mon, 19 Oct 2026 02:02:52 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

```
HTTP/1.1 302 Found
x-request-id: 01a151e5-bc95-70dd-8861-57046f1e5495
set-cookie: console-paths-session=01a151e5-bcc0-743a-8c9d-518292223d12:AwTUAmtC3GtGxjBOuW0ssJPR6cKTiSyP6dg0KmQ8tp0; HttpOnly; SameSite=Lax; Path=/
set-cookie: console-paths-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
location: http://localhost:3513/console/auth/callback?code=qX3zyGZMFWHLc3xs6WbxdQvDGEsYAhaJgG725QbCSi4&state=01a151e5-47f9-7b63-89ae-c0fb10717b4e.mM_2h-bfxFFbQPBrr-6XKbSIDUdO7z9XyDcttPZRtAc&iss=http%3A%2F%2Flocalhost%3A3513%2Ftenants%2Fconsole-paths
content-length: 0
Date: Mon, 19 Oct 2026 02:02:52 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

A copy of the jar, `jar-before-callback`, was taken here. A refused callback
clears the login cookie, so each refused request below is sent without
`-c`, and the jar it reads still holds the login cookie.

**A `state` that does not match the login cookie.** The code and `iss` are the
real ones; the `state` keeps the tenant half and replaces the secret. Each
callback here ran on `http://localhost:3513`, with `jar` holding the login
cookie that sign-in set and `$BAD` the callback below:

```bash
curl -sS -D - -b jar "$BAD"
```

`$BAD`, whose `state` is `<tenant id>.not-the-login-secret`:

```
http://localhost:3513/console/auth/callback?code=qX3zyGZMFWHLc3xs6WbxdQvDGEsYAhaJgG725QbCSi4&state=01a151e5-47f9-7b63-89ae-c0fb10717b4e.not-the-login-secret&iss=http%3A%2F%2Flocalhost%3A3513%2Ftenants%2Fconsole-paths
```

The first refusal restarts the sign-in rather than showing a page, and sets
`odudu-console-restart` so a second one inside its minute cannot loop:

```
HTTP/1.1 302 Found
x-request-id: 01a151e5-bcd9-7828-b0ca-630150968985
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=60
location: /console/
content-length: 0
Date: Mon, 19 Oct 2026 02:02:53 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The same request with that cookie sent answers the page. Its second header
block is the whole response:

```bash
curl -sS -D - -b jar -b odudu-console-restart=1 "$BAD"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a151e5-bce1-74bf-b14a-0f933bd5644e
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
content-type: text/html; charset=utf-8
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 778
Date: Mon, 19 Oct 2026 02:02:53 GMT
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

A mismatched `state` is refused before the pending sign-in is read, so the
pending sign-in and the code both survived it. The real callback, `$CB`, with
the same code, then signed in:

```bash
curl -sS -D - -c jar -b jar "$CB"
```

```
HTTP/1.1 302 Found
x-request-id: 01a151e5-bcea-7fd3-a40f-08684e053b30
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console=01a151e5-47f9-7b63-89ae-c0fb10717b4e.EzgE4DcwOvReR-OT-1SHb_LkBXsoih_MdMd7zSAE0Gw; HttpOnly; SameSite=Strict; Path=/
location: /console/x
content-length: 0
Date: Mon, 19 Oct 2026 02:02:53 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

**The same callback again.** The copy of the jar still holds the login
cookie, and its value is the `state` being replayed, so the refusal below
is not the missing or mismatched cookie refused above:

```bash
grep odudu-console-login jar-before-callback | cut -f6,7
```

```
odudu-console-login	01a151e5-47f9-7b63-89ae-c0fb10717b4e.mM_2h-bfxFFbQPBrr-6XKbSIDUdO7z9XyDcttPZRtAc
```

```bash
curl -sS -D - -b jar-before-callback "$CB"
```

```
HTTP/1.1 302 Found
x-request-id: 01a151e5-bd0d-75a1-bec8-19c6aa47eb44
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=60
location: /console/auth/login?tenant=console-paths
content-length: 0
Date: Mon, 19 Oct 2026 02:02:53 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The first refusal restarts again, this time to the tenant's own sign-in. With
the restart cookie sent, as above, it is the page:

```bash
curl -sS -D - -b jar-before-callback -b odudu-console-restart=1 "$CB"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a151e5-bd17-779e-a4d7-fd8c88b8d0af
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
content-type: text/html; charset=utf-8
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 778
Date: Mon, 19 Oct 2026 02:02:53 GMT
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

`$CB` is the `location` the tenant's `authenticate` answered, `$BAD` is `$CB`
with the secret replaced, and both are from this run. The first callback took
the pending sign-in, so the replay found none and was refused before the code
was presented again.

**An error from the authorization endpoint.** A new sign-in gave a new
login cookie and `state`:

```bash
curl -sS -D - -c jar -b jar \
  'http://localhost:3000/console/auth/login?tenant=console-paths&return_to=/console/x'
```

```
HTTP/1.1 302 Found
x-request-id: 01a0e741-a7d9-7a8b-9954-884464ed0bc8
cache-control: no-store
set-cookie: odudu-console-login=01a0e72d-5927-73c3-b14d-a5b60d1ca9ad.LQ36gGqeZQx-EjuRFtt7o9mUFB4QkwRJRCROC9wESTo; HttpOnly; SameSite=Lax; Path=/; Max-Age=600
location: http://localhost:3000/tenants/console-paths/protocol/openid-connect/auth?response_type=code&client_id=odudu-admin&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fconsole%2Fauth%2Fcallback&scope=openid&resource=urn%3Aodudu%3Aparams%3Aadmin-api&state=01a0e72d-5927-73c3-b14d-a5b60d1ca9ad.LQ36gGqeZQx-EjuRFtt7o9mUFB4QkwRJRCROC9wESTo&nonce=pcd5eoUxYu76CbdxKeaPz1A5PaJjVBUHidls9nErraI&code_challenge=HWdl9bQiMkQIYgkZeI7AUGsJjlm5vXB20XleoMvHVEk&code_challenge_method=S256
content-length: 0
Date: Mon, 28 Sep 2026 09:03:54 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The callback an authorization endpoint sends when the user refuses, with
that pending `state` and its login cookie:

```bash
curl -sS -D - -c jar -b jar \
  'http://localhost:3000/console/auth/callback?error=access_denied&state=01a0e72d-5927-73c3-b14d-a5b60d1ca9ad.LQ36gGqeZQx-EjuRFtt7o9mUFB4QkwRJRCROC9wESTo'
```

```
HTTP/1.1 302 Found
x-request-id: 01a0e741-ccd5-7a04-a3e7-111123c5bf6e
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
location: /console/?login_error=access_denied
content-length: 0
Date: Mon, 28 Sep 2026 09:04:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The gateway took the pending sign-in and cleared its cookie.

What the tenant held afterwards, with the same `psql` as the first run's
closing queries and the same trimmed header spaces:

```sql
select id, created_at from console_sessions where tenant_id = '01a0e72d-5927-73c3-b14d-a5b60d1ca9ad';
select count(*) as console_logins from console_logins where tenant_id = '01a0e72d-5927-73c3-b14d-a5b60d1ca9ad';
```

```
                  id                  |         created_at
--------------------------------------+----------------------------
 01a0e741-5a28-749e-908e-9382b6129149 | 2026-09-28 09:03:34.869+00
(1 row)

 console_logins
----------------
              0
(1 row)
```

One session, created at 09:03:34 by the callback that signed in. The two
refusals and the error callback created none, and no pending sign-in is
left. That session is the one every later second-run section uses.
