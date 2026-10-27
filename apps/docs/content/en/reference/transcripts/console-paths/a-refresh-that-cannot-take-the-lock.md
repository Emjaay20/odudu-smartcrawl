---
title: 'A refresh that cannot take the lock'
description: "A refresh waits at most five seconds for the session's row lock, so two refreshes of one session never present its refresh token twice."
---

# A refresh that cannot take the lock

On the same session, 4.5 minutes after its last refresh. A refresh holds
the session's row lock, waiting at most 5 s for it, so that two refreshes of one
session never present its refresh token twice. Here `psql` holds that lock for
12 s while a request that needs a refresh arrives. The lock is taken by this
file, `q-lock.sql`, through the same `psql`:

```sql
BEGIN;
SELECT id, clock_timestamp() AS locked_at FROM console_sessions WHERE id = '01a17b05-62e9-703b-8cae-7a216ade12de' FOR UPDATE;
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
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a17b04-bdeb-7b73-a5a4-a5674032af15
wait
curl -sS -D - -b jar \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a17b04-bdeb-7b73-a5a4-a5674032af15
curl -sS -D - -b jar \
  "http://localhost:3082/console/api/admin/tenants/system/audit?event_type=token&from=$FROM"
```

Before, the token was inside the refresh window:

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-27 01:59:45.641+00 | 00:00:25.049612
(1 row)
```

```
2026-10-27T01:59:20.642Z
```

The lock, held from 01:59:20.72 to 01:59:32.75. The `pg_sleep` value line
is a single space, trimmed below like the header spaces:

```
BEGIN
                  id                  |           locked_at
--------------------------------------+-------------------------------
 01a17b05-62e9-703b-8cae-7a216ade12de | 2026-10-27 01:59:20.718223+00
(1 row)

 pg_sleep
----------

(1 row)

         releasing_at
-------------------------------
 2026-10-27 01:59:32.746069+00
(1 row)

COMMIT
```

The `GET` sent while it was held waited 5 s for the lock and was answered
`502`, at 01:59:26, inside the lock's twelve seconds. curl's `time_total`
follows the body on the same line, since the body ends without a newline:

```
HTTP/1.1 502 Bad Gateway
x-request-id: 01a17b15-6344-7da4-a483-346725377432
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 107
Date: Tue, 27 Oct 2026 01:59:26 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":502,"type":"about:blank","title":"Bad Gateway","instance":"01a17b15-6344-7da4-a483-346725377432"}time_total: 5.009811
```

The session was kept. The `GET` after the commit refreshed and was
forwarded:

```
HTTP/1.1 200 OK
x-request-id: 01a17b15-8e9d-7644-a7b1-672254239460
content-type: application/json; charset=utf-8
etag: "6388aad52555e3d8157f0d1aeaf1c03670598e2fa9192465ec3d42b3d08f1f30"
cache-control: no-store
content-length: 144
Date: Tue, 27 Oct 2026 01:59:32 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17b04-bdeb-7b73-a5a4-a5674032af15","type":"user","username":"ada","email":null,"enabled":true,"created_at":"2026-10-27T01:41:10.686Z"}
```

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-27 02:04:32.765+00 | 00:04:59.882472
(1 row)
```

Since `$FROM` there is one `token.refresh`, the one after the commit. The
request that timed out on the lock never reached the token endpoint:

```
HTTP/1.1 200 OK
x-request-id: 01a17b15-8f26-7020-9939-0bb589cf7887
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 554
Date: Tue, 27 Oct 2026 01:59:32 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a17b15-8eae-7d0a-a1bd-3ebf43159064","occurred_at":"2026-10-27T01:59:32.778Z","event_type":"token","action":"token.refresh","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a17b04-bdeb-7b73-a5a4-a5674032af15","actor_client_id":"01a17b04-bdba-70e9-8479-8a048b960075","actor_name":"ada","actor_origin":"tenant","resource_type":"grant","resource_id":"01a17b05-62e2-7490-adbb-274465e8bca9","request_id":"01a17b15-8e9d-7644-a7b1-672254239460","ip":"172.22.0.1","detail":{"scope":"openid"}}]}
```

The run's session was not logged out until the next section ended it, so its
`console_sessions` row was there throughout.
