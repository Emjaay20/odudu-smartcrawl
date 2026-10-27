---
title: 'A refresh'
description: 'Within 30 seconds of expiry the gateway refreshes the access token as odudu-admin before it forwards a call; the browser sees no difference.'
---

# A refresh

On the session `01a17b05-62e9-…` of `ada`'s first sign-in. Every request before
it ran on an access token with more than 30 s left. The gateway refreshes before
forwarding when less is left, and the token lives 300 s, so this section waited
until the stored expiry was under 30 s away (6 s, in this run). The refresh is a call to the tenant's
token endpoint as `odudu-admin`, carrying the assertion it signs; the server's
own `token` audit row names the grant and the client, and the proxied `GET`
shows no difference to the browser. These ran one after another, `$FROM` being
the timestamp printed first:

```bash
python3 -c "import datetime;print(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.')+'%03dZ'%(datetime.datetime.now().microsecond//1000))"
curl -sS -D - -b jar \
  http://localhost:3082/console/api/admin/tenants/system/subjects/01a17b04-bdeb-7b73-a5a4-a5674032af15
curl -sS -D - -b jar \
  "http://localhost:3082/console/api/admin/tenants/system/audit?event_type=token&from=$FROM"
curl -sS -D - -b jar \
  "http://localhost:3082/console/api/admin/tenants/system/audit?action=grant.revoked_on_reuse&from=$FROM"
```

with this query, on the standard input of `psql` in the `postgres` container,
run before the `GET` and again after it:

```sql
select access_expires_at, access_expires_at - now() as remaining from console_sessions where id = '01a17b05-62e9-703b-8cae-7a216ade12de';
```

Before:

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-27 01:46:52.978+00 | 00:00:05.568734
(1 row)
```

`$FROM`, then the `GET`:

```
2026-10-27T01:46:47.451Z
```

```
HTTP/1.1 200 OK
x-request-id: 01a17b09-e128-717f-81a1-538eb2bb5837
content-type: application/json; charset=utf-8
etag: "6388aad52555e3d8157f0d1aeaf1c03670598e2fa9192465ec3d42b3d08f1f30"
cache-control: no-store
content-length: 144
Date: Tue, 27 Oct 2026 01:46:47 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17b04-bdeb-7b73-a5a4-a5674032af15","type":"user","username":"ada","email":null,"enabled":true,"created_at":"2026-10-27T01:41:10.686Z"}
```

After, the expiry is 300 s from the refresh:

```
     access_expires_at      |    remaining
----------------------------+-----------------
 2026-10-27 01:51:47.465+00 | 00:04:59.841544
(1 row)
```

The tenant's `token` audit rows since `$FROM` are one `token.refresh`, on
the grant the sign-in created, by the client `odudu-admin`:

```
HTTP/1.1 200 OK
x-request-id: 01a17b09-e1db-710d-b86b-a0a73fcc8a36
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 554
Date: Tue, 27 Oct 2026 01:46:47 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a17b09-e153-7180-a044-5464a480434a","occurred_at":"2026-10-27T01:46:47.498Z","event_type":"token","action":"token.refresh","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a17b04-bdeb-7b73-a5a4-a5674032af15","actor_client_id":"01a17b04-bdba-70e9-8479-8a048b960075","actor_name":"ada","actor_origin":"tenant","resource_type":"grant","resource_id":"01a17b05-62e2-7490-adbb-274465e8bca9","request_id":"01a17b09-e128-717f-81a1-538eb2bb5837","ip":"172.22.0.1","detail":{"scope":"openid"}}]}
```

and the refresh token was presented once, since reuse detection revoked
nothing:

```
HTTP/1.1 200 OK
x-request-id: 01a17b09-e1f7-7cf6-aa65-95a8ed144ed5
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 12
Date: Tue, 27 Oct 2026 01:46:47 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}
```
