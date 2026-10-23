---
title: 'A refresh the server refuses'
description: 'When the server refuses a refresh, the grant is revoked, the next call answers a session-ended 401 and clears its cookie, and the row is gone.'
---

# A refresh the server refuses

On the same session, straight after the lock section. Its grant is revoked
through the console itself, by ending the SSO session the grant is bound to; a
write names the session's subject in `X-Odudu-Console-Subject`, as every write
must, or it is refused as another principal's. `ada` holds two live sessions at
this point, the first sign-in's loopback one and this run's own,
`01a1203e-f2ca-…`, the one in its `system-session` cookie:

```bash
curl -sS -D - -b jar http://localhost:3082/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f/sessions
curl -sS -D - -c jar -b jar -X DELETE \
  -H 'Origin: http://localhost:3082' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a1203a-f86d-7e8e-a537-e39f5d77b04f' \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f/sessions/01a1203e-f2ca-78cb-833c-3ae98a36ca3d
```

```
HTTP/1.1 200 OK
x-request-id: 01a1204c-4db5-7d7c-bd3d-83edadb2f3cc
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 367
Date: Fri, 09 Oct 2026 10:53:54 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a1203b-5383-79a0-892a-1da6060f57f0","created_at":"2026-10-09T10:35:21.344Z","last_active_at":"2026-10-09T10:39:35.356Z","remembered":false,"client_ids":["odudu-admin"]},{"id":"01a1203e-f2ca-78cb-833c-3ae98a36ca3d","created_at":"2026-10-09T10:39:18.727Z","last_active_at":"2026-10-09T10:53:34.315Z","remembered":false,"client_ids":["odudu-admin"]}]}
```

```
HTTP/1.1 204 No Content
x-request-id: 01a1204c-4de9-7e43-80c8-dbf1b89fd6ae
cache-control: no-store
Date: Fri, 09 Oct 2026 10:53:54 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

This file, `q-state.sql`, run through the same `psql` as the refresh
sections, reads the console session's stored access-token expiry and
whether the grant is revoked. psql's trailing header spaces are trimmed
below:

```sql
select id, access_expires_at, access_expires_at - now() as remaining from console_sessions where tenant_id = '0199aa00-0000-7000-8000-000000000001' and subject_id = '01a1203a-f86d-7e8e-a537-e39f5d77b04f' and id = '01a1203f-0879-7a1c-bfb3-9ede557fa475';
select g.revoked_at is not null as revoked from token_grants g where g.session_id = '01a1203e-f2ca-78cb-833c-3ae98a36ca3d';
```

Right after the `DELETE`, the grant is revoked and the console session is
still there, its access token good for four more minutes:

```
                  id                  |     access_expires_at      |    remaining
--------------------------------------+----------------------------+-----------------
 01a1203f-0879-7a1c-bfb3-9ede557fa475 | 2026-10-09 10:58:34.254+00 | 00:04:40.003913
(1 row)

 revoked
---------
 t
(1 row)
```

Nothing was sent until the token was inside its 30 s refresh window. Then,
one after another: the query, a proxied `GET`, the query again, and the
session read with a copy of the jar taken before the `GET`:

```bash
docker compose -p odudu-docs-12b exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < q-state.sql
cp jar jar-before-call
curl -sS -D - -c jar -b jar \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f
docker compose -p odudu-docs-12b exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < q-state.sql
curl -sS -D - -b jar-before-call http://localhost:3082/console/api/session
```

```
                  id                  |     access_expires_at      |    remaining
--------------------------------------+----------------------------+-----------------
 01a1203f-0879-7a1c-bfb3-9ede557fa475 | 2026-10-09 10:58:34.254+00 | 00:00:19.181579
(1 row)

 revoked
---------
 t
(1 row)
```

The `GET` is the session-ended `401`, and its cookie is cleared:

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a12050-49e1-7823-83b7-70f09b95f1fc
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Fri, 09 Oct 2026 10:58:15 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":401,"type":"about:blank#console-session-ended","title":"Unauthorized","instance":"01a12050-49e1-7823-83b7-70f09b95f1fc"}
```

The row is gone:

```
 id | access_expires_at | remaining
----+-------------------+-----------
(0 rows)

 revoked
---------
 t
(1 row)
```

The cookie from before the `GET` names nothing now:

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a12050-4ab7-7137-83c3-f6d2dc04728c
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Fri, 09 Oct 2026 10:58:15 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":401,"type":"about:blank#console-session-ended","title":"Unauthorized","instance":"01a12050-4ab7-7137-83c3-f6d2dc04728c"}
```

The server's request log for that second shows which check ended it. The
`GET` never reached `/admin/`. The gateway refreshed first, under the
`GET`'s own request id, and the token endpoint answered `400`:

```bash
docker compose -p odudu-docs-12b logs --since $(cat p3-from.txt) odudu 2>&1 \
  | sed 's/^[^{]*//' \
  | jq -c 'select(.msg == "incoming request" or .msg == "request completed") | [.reqId, .req.method // .res.statusCode, .req.url // null]'
```

```
["01a12050-49e1-7823-83b7-70f09b95f1fc","GET","/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f"]
["01a12050-49e1-7823-83b7-70f09b95f1fc","POST","/tenants/system/protocol/openid-connect/token"]
["01a12050-49e1-7823-83b7-70f09b95f1fc",400,null]
["01a12050-49e1-7823-83b7-70f09b95f1fc",401,null]
["01a12050-4ab7-7137-83c3-f6d2dc04728c","GET","/console/api/session"]
["01a12050-4ab7-7137-83c3-f6d2dc04728c",401,null]
```
