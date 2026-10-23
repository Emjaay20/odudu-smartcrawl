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
x-request-id: 01a12040-db4a-7d9e-9fb1-c6bc676c7cea
set-cookie: system-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: system-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
cache-control: no-store
location: http://localhost:3082/console/
content-length: 0
Date: Fri, 09 Oct 2026 10:41:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

What is left, read from the database as the superuser, with these three queries
in a file piped to `psql` in the `postgres` container. Each query is scoped to
this session's `console_sessions` row or to the SSO session id
`01a12040-c04d-…`, the one in the `system-session` cookie and the ID token's
`sid`. psql ends each header line with a space, which the formatter trims below;
nothing else differs from what it printed:

```sql
select count(*) as console_sessions from console_sessions where tenant_id = '0199aa00-0000-7000-8000-000000000001' and id = '01a12040-c096-7eef-8eac-4c64f5f6d0a4';
select id, expires_at <= now() as expired from sessions where id = '01a12040-c04d-7e92-917f-adf796bd0e93';
select g.session_id, g.revoked_at is not null as revoked from token_grants g join clients c on c.id = g.client_id where g.tenant_id = '0199aa00-0000-7000-8000-000000000001' and c.client_id = 'odudu-admin' and g.session_id = '01a12040-c04d-7e92-917f-adf796bd0e93';
```

```
 console_sessions
------------------
                0
(1 row)

                  id                  | expired
--------------------------------------+---------
 01a12040-c04d-7e92-917f-adf796bd0e93 | t
(1 row)

              session_id              | revoked
--------------------------------------+---------
 01a12040-c04d-7e92-917f-adf796bd0e93 | t
(1 row)
```

The console cookie from before the logout, sent again (from a copy of the
jar taken just before the logout), is an ended session:

```bash
curl -sS -D - -b jar-before-logout http://localhost:3082/console/api/session
```

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a12040-f610-7864-ab5f-dc37d2bafd61
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Fri, 09 Oct 2026 10:41:30 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":401,"type":"about:blank#console-session-ended","title":"Unauthorized","instance":"01a12040-f610-7864-ab5f-dc37d2bafd61"}
```
