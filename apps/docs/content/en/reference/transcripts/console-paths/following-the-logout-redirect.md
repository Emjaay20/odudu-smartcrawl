---
title: 'Following the logout redirect'
description: 'After a console logout the browser follows the redirect and confirms, and the old console cookie is an ended session.'
---

# Following the logout redirect

`$REDIRECT` is the `redirect` above. The jar still holds `system-session` from
the sign-in. The tenant's logout endpoint asks before it ends anything, however
fresh the ID token in the URL is: it answers the confirmation page, and the SSO
session is still live. This page ran on a fresh stack at
`http://localhost:3191` with the tenant `system` and the user
`grace` seeded, and shortens the `session_id` and `csrf` the form carries:

```bash
curl -sS -D - -c jar -b jar "$REDIRECT" | tee page.txt
```

```
HTTP/1.1 200 OK
x-request-id: 01a17cd9-8327-76aa-8da0-cb488e9c77b9
content-type: text/html
content-security-policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self' http://localhost:3191; base-uri 'none'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-language: en
content-length: 1321
Date: Tue, 27 Oct 2026 10:13:12 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Sign out?</title>
<link rel="stylesheet" href="/instrument/instrument.css">
<link rel="icon" href="/instrument/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/instrument/favicon.ico" sizes="48x48">
</head>
<body>
<main class="page">
<p class="brand"><svg class="mark" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="16" cy="6" r="4"/><path d="M16 10V30"/><path d="M12 14H20"/></svg><span class="wordmark">odudu</span></p>
<h1>Sign out?</h1>
<p>Signing out ends this session for every application that uses it.</p>
<form method="post" action="/tenants/system/protocol/openid-connect/logout">
  <input type="hidden" name="session_id" value="01a17cd9-828a-…">
  <input type="hidden" name="csrf" value="p-jRdklRE0EE…">
  <input type="hidden" name="client_id" value="odudu-admin">
  <input type="hidden" name="post_logout_redirect_uri" value="http://localhost:3191/console/">
  <button type="submit">Sign out</button>
</form>
</main>
</body>
</html>
```

The browser posts that form back. `field` reads one hidden field out of the page,
saved above by `tee`; the request is the one the form makes, to the logout
endpoint's address without its query:

```bash
field() { sed -n "s/.*name=.$1. value=.\([^>]*\).>.*/\1/p" page.txt; }
curl -sS -D - -c jar -b jar -o /dev/null -X POST \
  --data-urlencode "session_id=$(field session_id)" --data-urlencode "csrf=$(field csrf)" \
  --data-urlencode "client_id=$(field client_id)" \
  --data-urlencode "post_logout_redirect_uri=$(field post_logout_redirect_uri)" \
  "${REDIRECT%%\?*}"
```

```
HTTP/1.1 302 Found
x-request-id: 01a17cd9-847b-7f9c-b535-ea9df773ab08
set-cookie: system-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: system-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
cache-control: no-store
location: http://localhost:3191/console/
content-length: 0
Date: Tue, 27 Oct 2026 10:13:12 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

What is left, read from the database as the superuser. The queries below ran after the form was
posted. They show the SSO session id `01a17cd9-828a-…`, the one in the `system-session` cookie
and the ID token's `sid`, ended. The first query counts the tenant's `console_sessions`
rows, and this stack has had no other console session. psql ends each header line
with a space, which the formatter trims below; nothing else differs from what it
printed:

```sql
select count(*) as console_sessions from console_sessions where tenant_id = '0199aa00-0000-7000-8000-000000000001';
select id, expires_at <= now() as expired from sessions where id = '01a17cd9-828a-7b12-aed2-efa6451594b7';
select g.session_id, g.revoked_at is not null as revoked from token_grants g join clients c on c.id = g.client_id where g.tenant_id = '0199aa00-0000-7000-8000-000000000001' and c.client_id = 'odudu-admin' and g.session_id = '01a17cd9-828a-7b12-aed2-efa6451594b7';
```

```
 console_sessions
------------------
                0
(1 row)

                  id                  | expired
--------------------------------------+---------
 01a17cd9-828a-7b12-aed2-efa6451594b7 | t
(1 row)

              session_id              | revoked
--------------------------------------+---------
 01a17cd9-828a-7b12-aed2-efa6451594b7 | t
(1 row)
```

The console cookie from before the logout, sent again (from a copy of the
jar taken just before the logout), is an ended session:

```bash
curl -sS -D - -b jar-before-logout http://localhost:3191/console/api/session
```

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a17cd9-85ff-723d-8830-1975338c2303
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Tue, 27 Oct 2026 10:13:12 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":401,"type":"about:blank#console-session-ended","title":"Unauthorized","instance":"01a17cd9-85ff-723d-8830-1975338c2303"}
```
