---
title: 'GET /subjects/:id'
description: 'Requires view-users, the same capability the listing does.'
---

# `GET /subjects/:id`

Requires `view-users`, the same capability the listing does. Carries an
`ETag` computed over the response body, the same convention every other
single-resource read in this API follows; an unknown id answers `404`.

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/subjects/01a17aed-7bb8-7f5e-9b9c-d205689a4e89
```

```
HTTP/1.1 200 OK
x-request-id: 01a17af1-8894-7614-ae1f-885b9de985fe
cache-control: no-store
etag: "da3eb48382f6ee2d1dba5ab0257b85618325684e6073d398d382992fd751164c"
content-type: application/json; charset=utf-8
content-length: 157
Date: Tue, 27 Oct 2026 01:20:11 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17aed-7bb8-7f5e-9b9c-d205689a4e89","type":"user","username":"ada","email":"ada@example.com","enabled":true,"created_at":"2026-10-27T01:15:46.485Z"}
```
