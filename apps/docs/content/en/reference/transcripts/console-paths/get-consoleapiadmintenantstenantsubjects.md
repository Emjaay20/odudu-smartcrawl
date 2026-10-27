---
title: 'GET /console/api/admin/tenants/{tenant}/subjects'
description: "Anything under /console/api/admin/ is forwarded to /admin/ with the session's access token."
---

# `GET /console/api/admin/tenants/{tenant}/subjects`

Anything under `/console/api/admin/` is forwarded to `/admin/` with the
session's access token. `limit=1` gives the list a second page, so the
admin API answers with a `Link` header.

```bash
curl -sS -D - -c jar -b jar \
  'http://localhost:3000/console/api/admin/tenants/console-paths/subjects?limit=1'
```

```
HTTP/1.1 200 OK
x-request-id: 01a17b02-e004-7146-add9-213b56edb775
content-type: application/json; charset=utf-8
link: </console/api/admin/tenants/console-paths/subjects?limit=1&cursor=eyJhZnRlciI6IjAxYTE3YjAyLTFjYjMtNzIwYS1hYjljLWEwY2M0NGUxMDdhMiIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMTdiMDItMWE5YS03OGY0LWE3NDYtMWEyMjNhNTMzY2E3IiwiZmlsdGVycyI6IlQxUE5vWXdycWd3RFZMdGZtajdMNWUwU3EwMk9FYnFIUEM4UkZoSUN1VVUifQ.aOYXCtcday8jhkrmE-cGDC_a03mFKWbOaZO1Tj2LuWA>; rel="next"
cache-control: no-store
content-length: 465
Date: Tue, 27 Oct 2026 01:39:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a17b02-1cb3-720a-ab9c-a0cc44e107a2","type":"user","username":"grace","email":"grace@example.com","enabled":true,"created_at":"2026-10-27T01:38:18.413Z"}],"next":"eyJhZnRlciI6IjAxYTE3YjAyLTFjYjMtNzIwYS1hYjljLWEwY2M0NGUxMDdhMiIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMTdiMDItMWE5YS03OGY0LWE3NDYtMWEyMjNhNTMzY2E3IiwiZmlsdGVycyI6IlQxUE5vWXdycWd3RFZMdGZtajdMNWUwU3EwMk9FYnFIUEM4UkZoSUN1VVUifQ.aOYXCtcday8jhkrmE-cGDC_a03mFKWbOaZO1Tj2LuWA"}
```

The admin API sent `Link: </admin/tenants/console-paths/subjects?…>`, and the
gateway rewrote it to `/console/api/admin/`. Following it through the proxy
reaches the second page. `$NEXT` is the path inside the `<…>` above.

```bash
curl -sS -D - -c jar -b jar "http://localhost:3000$NEXT"
```

```
HTTP/1.1 200 OK
x-request-id: 01a17b02-e03e-701d-982a-a4d60cc591bb
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 175
Date: Tue, 27 Oct 2026 01:39:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a17b02-1fe4-708f-9306-bf08a3f3062f","type":"user","username":"hopper","email":"hopper@example.com","enabled":true,"created_at":"2026-10-27T01:38:19.231Z"}]}
```
