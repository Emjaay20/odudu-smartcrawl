---
title: 'A refresh'
description: 'Within 30 seconds of expiry the gateway refreshes the access token as odudu-admin before it forwards a call; the browser sees no difference.'
---

# A refresh

On the session `01a1203f-0879-…` of `ada`'s first sign-in. Every request before
it ran on an access token with more than 30 s left. The gateway refreshes before
forwarding when less is left, and the token lives 300 s, so this section waited
until the stored expiry was 18 s away. The refresh is a call to the tenant's
token endpoint as `odudu-admin`, carrying the assertion it signs; the server's
own `token` audit row names the grant and the client, and the proxied `GET`
shows no difference to the browser. These ran one after another, `$FROM` being
the timestamp printed first:

```bash
python3 -c "import datetime;print(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.')+'%03dZ'%(datetime.datetime.now().microsecond//1000))"
curl -sS -D - -b jar \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a1203a-f86d-7e8e-a537-e39f5d77b04f
curl -sS -D - -b jar \
  "http://localhost:3082/console/api/admin/tenants/system/audit?event_type=token&from=$FROM"
curl -sS -D - -b jar \
  "http://localhost:3082/console/api/admin/tenants/system/audit?action=grant.revoked_on_reuse&from=$FROM"
```

with this query, on the standard input of `psql` in the `postgres` container,
run before the `GET` and again after it:

```sql
select access_expires_at, access_expires_at - now() as remaining from console_sessions where id = '01a1203f-0879-7a1c-bfb3-9ede557fa475';
```

Before:

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-09 10:44:24.136+00 | 00:00:18.691772
(1 row)
```

`$FROM`, then the `GET`:

```
2026-10-09T10:44:05.483Z
```

```
HTTP/1.1 200 OK
x-request-id: 01a12043-5301-7cce-b4d6-9a4e34815cb7
content-type: application/json; charset=utf-8
etag: "8f184ae83744abf07346b2aeb60c88049dd813d5f36f0820b6e1ab4216f2a0cd"
cache-control: no-store
content-length: 144
Date: Fri, 09 Oct 2026 10:44:05 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a1203a-f86d-7e8e-a537-e39f5d77b04f","type":"user","username":"ada","email":null,"enabled":true,"created_at":"2026-10-09T10:34:57.804Z"}
```

After, the expiry is 300 s from the refresh:

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-09 10:49:05.514+00 | 00:04:59.673808
(1 row)
```

The tenant's `token` audit rows since `$FROM` are one `token.refresh`, on
the grant the sign-in created, by the client `odudu-admin`:

```
HTTP/1.1 200 OK
x-request-id: 01a12043-5472-7982-b939-3864922d61fb
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 554
Date: Fri, 09 Oct 2026 10:44:05 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a12043-5374-7221-bd12-c458eec0d9d0","occurred_at":"2026-10-09T10:44:05.608Z","event_type":"token","action":"token.refresh","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a1203a-f86d-7e8e-a537-e39f5d77b04f","actor_client_id":"01a1203a-f7c6-76b2-89fa-7c51f3507f28","actor_name":"ada","actor_origin":"tenant","resource_type":"grant","resource_id":"01a1203f-0864-7643-8bc4-e32975f8c31d","request_id":"01a12043-5301-7cce-b4d6-9a4e34815cb7","ip":"172.22.0.1","detail":{"scope":"openid"}}]}
```

and the refresh token was presented once, since reuse detection revoked
nothing:

```
HTTP/1.1 200 OK
x-request-id: 01a12043-54b1-700c-a08d-0635ebd9e6f1
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 12
Date: Fri, 09 Oct 2026 10:44:05 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}
```
