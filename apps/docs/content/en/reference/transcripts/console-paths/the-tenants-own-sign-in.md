---
title: "The tenant's own sign-in"
description: "The two requests between the gateway's redirect and its callback are the tenant's authorization endpoint and sign-in form, which…"
---

# The tenant's own sign-in

The two requests between the gateway's redirect and its callback are the
tenant's authorization endpoint and sign-in form, which [the request
paths](../request-paths/index.md) documents. They are shown here only so that
the callback below has a real code. This section and the `authenticate` request
below ran at `http://localhost:3094`, with `console-paths` and `grace` seeded on
it; `$LOCATION` is the `location` that stack's own `login` printed, so its ids
are not the ones in the blocks above and below.

```bash
curl -sS -D - -c jar -b jar "$LOCATION"
```

The page continues with the passkey form and its script; the block stops
at the end of the password form, where a `…` line says so.

```
HTTP/1.1 200 OK
x-request-id: 01a137da-0686-7870-954e-e3de76d272b7
content-type: text/html
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self' http://localhost:3094; base-uri 'none'; script-src 'nonce-OMn01UznIrcg/AqkJ+gqsg=='; connect-src 'self'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 3305
Date: Wed, 14 Oct 2026 00:39:57 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Sign in</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/instrument/favicon.ico" sizes="48x48">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="16" cy="6" r="4"/><path d="M16 10V30"/><path d="M12 14H20"/></svg><span class="wordmark">odudu</span></p>
<header class="intro">
<h1>Sign in</h1>
<p class="context">to continue to <bdi>Odudu administration</bdi></p>
<p class="tenant"><bdi>console-paths</bdi></p>
</header>
<form method="post" action="/tenants/console-paths/login-actions/authenticate">
  <input type="hidden" name="auth_session_id" value="01a137da-0690-7e7c-b322-b21a3a5e09ee">
  <label>Username <input type="text" name="username" autocomplete="username"></label>
  <label>Password <input type="password" name="password" autocomplete="current-password"></label>
  <button type="submit">Sign in</button>
</form>
…
```

The policy on this page also names the origin of the console's own
`redirect_uri` in `form-action`, as every page that continues an
authorization request does
([ADR 0018](https://github.com/wizzywit/odudu/blob/main/docs/adr/0018-framing-defence-on-rendered-pages.md)'s second
amendment). For the console that is the server's own origin, so nothing it
can reach changes.

```bash
curl -sS -D - -c jar -b jar -X POST \
  --data-urlencode auth_session_id=01a137da-0690-7e7c-b322-b21a3a5e09ee \
  --data-urlencode username=grace \
  --data-urlencode password=console-paths-throwaway \
  http://localhost:3094/tenants/console-paths/login-actions/authenticate
```

```
HTTP/1.1 302 Found
x-request-id: 01a137da-06c8-7cbc-a848-777c6b74759d
set-cookie: console-paths-session=01a137da-06ff-7602-b6c3-23886c64fba6:oAApL7Omp-0WwioQ9gy4rgUndQOZCix751Wx4WntqTY; HttpOnly; SameSite=Lax; Path=/
set-cookie: console-paths-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
location: http://localhost:3094/console/auth/callback?code=W_2mMr2fbUUNmes4CDXdS8NOkBgRb4i1amEwJf7BcSc&state=01a137da-01b1-75f9-9d2e-78567e208441.26s_IdV-sgdsmCgH0R8Auchb963B7ltflwolNOwPBsE&iss=http%3A%2F%2Flocalhost%3A3094%2Ftenants%2Fconsole-paths
content-length: 0
Date: Wed, 14 Oct 2026 00:39:57 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

`console-paths-session` is the tenant's SSO cookie. The logout below needs
the browser to send it.
