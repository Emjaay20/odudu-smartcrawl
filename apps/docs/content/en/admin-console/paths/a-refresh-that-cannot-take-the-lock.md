---
title: 'A refresh that cannot take the lock'
description: 'From the seventh run, on the same session, about 4.5 minutes after the refresh above.'
---

# A refresh that cannot take the lock

From the seventh run, on the same session, about 4.5 minutes after the refresh
above. A refresh holds the session's row lock, waiting at most 5 s for it,
so that two refreshes of one session never present its refresh token
twice. Here `psql` holds that lock for 12 s while a request that needs a
refresh arrives. The lock is taken by this file, `q-lock.sql`, through the
same `psql`:

```sql
BEGIN;
SELECT id, clock_timestamp() AS locked_at FROM console_sessions WHERE id = '01a1203f-0879-7a1c-bfb3-9ede557fa475' FOR UPDATE;
SELECT pg_sleep(12);
SELECT clock_timestamp() AS releasing_at;
COMMIT;
```

The steps, in order: the expiry query from the section above; `$FROM`;
the lock file started in the background; one second later the `GET`, with
curl printing its total time; then, once `psql` had committed, the same
`GET`, the expiry query, and the `token` audit rows since `$FROM`.

```bash
python3 -c "import datetime;print(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.')+'%03dZ'%(datetime.datetime.now().microsecond//1000))"
docker compose -p odudu-docs-12b exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < q-lock.sql &
sleep 1
curl -sS -D - -w 'time_total: %{time_total}\n' -b jar \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f
wait
curl -sS -D - -b jar \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f
curl -sS -D - -b jar \
  "http://localhost:3082/console/api/admin/tenants/system/audit?event_type=token&from=$FROM"
```

Before, the token was inside the refresh window:

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-09 10:49:05.514+00 | 00:00:24.238473
(1 row)
```

```
2026-10-09T10:48:41.309Z
```

The lock, held from 10:48:41.44 to 10:48:53.45. The `pg_sleep` value line
is a single space, trimmed below like the header spaces:

```
BEGIN
                  id                  |           locked_at
--------------------------------------+-------------------------------
 01a1203f-0879-7a1c-bfb3-9ede557fa475 | 2026-10-09 10:48:41.441836+00
(1 row)

 pg_sleep
----------

(1 row)

         releasing_at
-------------------------------
 2026-10-09 10:48:53.451078+00
(1 row)

COMMIT
```

The `GET` sent while it was held waited 5 s for the lock and was answered
`502`, at 10:48:47, inside the lock's twelve seconds. curl's `time_total`
follows the body on the same line, since the body ends without a newline:

```
HTTP/1.1 502 Bad Gateway
x-request-id: 01a12047-8c7d-7ae6-be03-e1f46bbd2bcd
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 107
Date: Fri, 09 Oct 2026 10:48:47 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":502,"type":"about:blank","title":"Bad Gateway","instance":"01a12047-8c7d-7ae6-be03-e1f46bbd2bcd"}time_total: 5.126018
```

The session was kept. The `GET` after the commit refreshed and was
forwarded:

```
HTTP/1.1 200 OK
x-request-id: 01a12047-b7ed-7793-af71-d2b5d3c5d757
content-type: application/json; charset=utf-8
etag: "8f184ae83744abf07346b2aeb60c88049dd813d5f36f0820b6e1ab4216f2a0cd"
cache-control: no-store
content-length: 144
Date: Fri, 09 Oct 2026 10:48:53 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a1203a-f86d-7e8e-a537-e39f5d77b04f","type":"user","username":"ada","email":null,"enabled":true,"created_at":"2026-10-09T10:34:57.804Z"}
```

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-09 10:53:53.486+00 | 00:04:59.811109
(1 row)
```

Since `$FROM` there is one `token.refresh`, the one after the commit. The
request that timed out on the lock never reached the token endpoint:

```
HTTP/1.1 200 OK
x-request-id: 01a12047-b8c3-785d-bbef-c5b36d0fd8fd
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 554
Date: Fri, 09 Oct 2026 10:48:53 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a12047-b81e-71cb-8f77-2c76058f549c","occurred_at":"2026-10-09T10:48:53.528Z","event_type":"token","action":"token.refresh","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a1203a-f86d-7e8e-a537-e39f5d77b04f","actor_client_id":"01a1203a-f7c6-76b2-89fa-7c51f3507f28","actor_name":"ada","actor_origin":"tenant","resource_type":"grant","resource_id":"01a1203f-0864-7643-8bc4-e32975f8c31d","request_id":"01a12047-b7ed-7793-af71-d2b5d3c5d757","ip":"172.22.0.1","detail":{"scope":"openid"}}]}
```

The run's session was not logged out until the next section ended it, so its
`console_sessions` row was there throughout.
