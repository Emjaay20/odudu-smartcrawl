---
title: 'Subject create, refused as cross-site'
description: "A write to /console/api/ or /console/auth/ is refused with a 403 unless it carries the base's own Origin and the X-Odudu-Console: 1 header."
---

# Subject create, refused as cross-site

This page covers `POST /console/api/admin/tenants/{tenant}/subjects`, refused as cross-site.

A request to `/console/api/` or `/console/auth/` other than `GET`, `HEAD` or
`OPTIONS` is refused `403` before anything else runs, unless it carries `Origin`
equal to the base's origin and `X-Odudu-Console: 1`. The refusal has the admin
API's own `403` type, `about:blank`, and says why in `detail`. All three
requests below have the same valid session cookie, the same subject header and
the same body. The first sends another origin:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: https://evil.example' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  -H 'Content-Type: application/json' \
  -d '{"username":"babbage","email":"babbage@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects
```

```
HTTP/1.1 403 Forbidden
x-request-id: 01a13ff3-6c8f-75c8-8cd7-2e257c06a71f
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 155
Date: Thu, 15 Oct 2026 14:24:40 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":403,"type":"about:blank","title":"Forbidden","detail":"refused as cross-site: origin-mismatch","instance":"01a13ff3-6c8f-75c8-8cd7-2e257c06a71f"}
```

The second sends the right origin without the console's header:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: http://localhost:3185' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  -H 'Content-Type: application/json' \
  -d '{"username":"babbage","email":"babbage@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects
```

```
HTTP/1.1 403 Forbidden
x-request-id: 01a13ff3-6c9d-712c-8fb9-554b975b8841
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 162
Date: Thu, 15 Oct 2026 14:24:40 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":403,"type":"about:blank","title":"Forbidden","detail":"refused as cross-site: console-header-missing","instance":"01a13ff3-6c9d-712c-8fb9-554b975b8841"}
```

The third sends both, and is forwarded. This shows the two refusals above
were the gateway's, not the admin API refusing the body or the session:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: http://localhost:3185' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  -H 'Content-Type: application/json' \
  -d '{"username":"babbage","email":"babbage@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects
```

```
HTTP/1.1 201 Created
x-request-id: 01a13ff3-6cab-7cd2-baa1-84186f702bbf
content-type: application/json; charset=utf-8
etag: "75ffef77024523cf6928e5a7089ef7e0173370b9713f0e77a01accf6611f60c1"
cache-control: no-store
content-length: 165
Date: Thu, 15 Oct 2026 14:24:40 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a13ff3-6cc0-75d5-9765-a07ee40d3e06","type":"user","username":"babbage","email":"babbage@example.com","enabled":true,"created_at":"2026-10-15T14:24:40.127Z"}
```
