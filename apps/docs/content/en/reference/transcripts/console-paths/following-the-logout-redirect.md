---
title: 'Following the logout redirect'
description: 'After a console logout the browser follows the redirect, and the console cookie it held from before the logout is an ended session.'
---

# Following the logout redirect

`$REDIRECT` is the `redirect` above. The jar still holds `system-session` from
the sign-in.

```bash
curl -sS -D - -c jar -b jar "$REDIRECT"
```

```
HTTP/1.1 302 Found
x-request-id: 01a17b06-5d02-771a-bb29-5bf5ef6012fd
set-cookie: system-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: system-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
cache-control: no-store
location: http://localhost:3082/console/
content-length: 0
Date: Tue, 27 Oct 2026 01:42:57 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

What is left, read from the database as the superuser, with these three queries
in a file piped to `psql` in the `postgres` container. Each query is scoped to
this session's `console_sessions` row or to the SSO session id
`01a17b06-36c7-…`, the one in the `system-session` cookie and the ID token's
`sid`. psql ends each header line with a space, which the formatter trims below;
nothing else differs from what it printed:

```sql
select count(*) as console_sessions from console_sessions where tenant_id = '0199aa00-0000-7000-8000-000000000001' and id = '01a17b06-36fd-7282-b675-7f25561ca254';
select id, expires_at <= now() as expired from sessions where id = '01a17b06-36c7-730c-a30a-8f851c5c4e70';
select g.session_id, g.revoked_at is not null as revoked from token_grants g join clients c on c.id = g.client_id where g.tenant_id = '0199aa00-0000-7000-8000-000000000001' and c.client_id = 'odudu-admin' and g.session_id = '01a17b06-36c7-730c-a30a-8f851c5c4e70';
```

```
 console_sessions
------------------
                0
(1 row)

                  id                  | expired
--------------------------------------+---------
 01a17b06-36c7-730c-a30a-8f851c5c4e70 | t
(1 row)

              session_id              | revoked
--------------------------------------+---------
 01a17b06-36c7-730c-a30a-8f851c5c4e70 | t
(1 row)
```

The console cookie from before the logout, sent again (from a copy of the
jar taken just before the logout), is an ended session:

```bash
curl -sS -D - -b jar-before-logout http://localhost:3082/console/api/session
```

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a17b06-5d73-75b8-93af-1af12370fbef
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Tue, 27 Oct 2026 01:42:57 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":401,"type":"about:blank#console-session-ended","title":"Unauthorized","instance":"01a17b06-5d73-75b8-93af-1af12370fbef"}
```
