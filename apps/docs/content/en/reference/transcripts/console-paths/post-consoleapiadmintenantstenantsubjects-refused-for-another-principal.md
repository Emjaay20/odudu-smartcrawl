---
title: 'POST …/subjects, refused for another principal'
description: "Every tab shares the console cookie, so another tab's sign-in can replace the session; the console names the subject it expects on each request."
---

## `POST /console/api/admin/tenants/{tenant}/subjects`, refused for another principal

On the same tenant. Every tab of a browser shares the console cookie, so another
tab's sign-in can replace the session under a page that still shows the old
administrator. The console therefore names, on each admin request, the subject
its tab believes is signed in, in `X-Odudu-Console-Subject`. The session this
run's `jar` carries is `grace`'s:

```bash
curl -sS -D - -c jar -b jar http://localhost:3185/console/api/session
```

```
HTTP/1.1 200 OK
x-request-id: 01a13ff3-8277-7d7b-a675-a2fce66260f9
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 97
Date: Thu, 15 Oct 2026 14:24:45 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"tenant":"console-paths","subject_id":"01a13ff2-eff9-746c-b8cb-e56af2072daa","username":"grace"}
```

The three writes below ran one after another, between
`2026-10-15T14:24:45.738Z` and `2026-10-15T14:24:45.846Z` as
`new Date().toISOString()` printed them before and after, with the same
cookie and body. The first names `hopper`, another subject of the tenant, and is
refused `409` with the gateway's own problem type. The session is live, so
the cookie is left alone:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: http://localhost:3185' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-f33a-79ce-a952-0aeec04a80d4' \
  -H 'Content-Type: application/json' \
  -d '{"username":"lovelace","email":"lovelace@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a13ff3-82b7-7c08-9976-da2cd1906ab8
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Thu, 15 Oct 2026 14:24:45 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":409,"type":"about:blank#console-principal-changed","title":"Conflict","instance":"01a13ff3-82b7-7c08-9976-da2cd1906ab8"}
```

The second names no subject. A write that does not say who it acts for is
refused the same way; a read that names nobody is still forwarded:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: http://localhost:3185' -H 'X-Odudu-Console: 1' \
  -H 'Content-Type: application/json' \
  -d '{"username":"lovelace","email":"lovelace@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a13ff3-82c7-70e7-ae4e-61259517bd0c
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 130
Date: Thu, 15 Oct 2026 14:24:45 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":409,"type":"about:blank#console-principal-changed","title":"Conflict","instance":"01a13ff3-82c7-70e7-ae4e-61259517bd0c"}
```

The third names `grace`, and is forwarded. The refusals above were the
gateway's, not the admin API refusing the body:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: http://localhost:3185' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  -H 'Content-Type: application/json' \
  -d '{"username":"lovelace","email":"lovelace@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects
```

```
HTTP/1.1 201 Created
x-request-id: 01a13ff3-82d7-7673-a308-c737b160a07e
content-type: application/json; charset=utf-8
etag: "a2ce5bf02107d3ac576007a7107ff7fd5fccf91e7d1e1c7c51376c48046f85f9"
cache-control: no-store
content-length: 167
Date: Thu, 15 Oct 2026 14:24:45 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a13ff3-82ec-7627-b426-616ba224159c","type":"user","username":"lovelace","email":"lovelace@example.com","enabled":true,"created_at":"2026-10-15T14:24:45.803Z"}
```

The audit trail for that second, read through the proxy, holds one row,
the third write's. The two refused writes reached nothing:

```bash
curl -sS -D - -b jar -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  'http://localhost:3185/console/api/admin/tenants/console-paths/audit?from=2026-10-15T14:24:45Z&to=2026-10-15T14:24:46Z'
```

```
HTTP/1.1 200 OK
x-request-id: 01a13ff3-90bc-7645-93c2-b50e860c88fb
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 552
Date: Thu, 15 Oct 2026 14:24:49 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a13ff3-82f0-7a4e-aec6-f4859251f88e","occurred_at":"2026-10-15T14:24:45.803Z","event_type":"admin_mutation","action":"subject.create","outcome":"allowed","actor_tenant_id":"01a13ff2-eddb-7d89-8555-c32d1cd8acf9","actor_subject_id":"01a13ff2-eff9-746c-b8cb-e56af2072daa","actor_client_id":"01a13ff2-ee18-7fab-b610-0fb99df8e511","actor_name":"grace","actor_origin":"tenant","resource_type":"subject","resource_id":"01a13ff3-82ec-7627-b426-616ba224159c","request_id":"01a13ff3-82d7-7673-a308-c737b160a07e","ip":"172.20.0.1","detail":{}}]}
```
