---
title: 'A path that escapes /admin/'
description: 'From the second run, on its session. The proxy resolves the path it would forward, dot segments and their percent-encoded form included, and refuses…'
---

## A path that escapes `/admin/`

From the second run, on its session. The proxy resolves the path it would
forward, dot segments and their percent-encoded form included, and refuses
`404` before reading the session when the result is outside `/admin/`.
`--path-as-is` stops curl from resolving the dot segments itself. Both
requests were sent between the two timestamps printed around them:

```bash
node -e 'console.log(new Date().toISOString())'
curl --path-as-is -sS -D - -b jar 'http://localhost:3000/console/api/admin/%2e%2e/tenants/console-paths/protocol/openid-connect/token'
curl --path-as-is -sS -D - -b jar 'http://localhost:3000/console/api/admin/../tenants/console-paths/protocol/openid-connect/token'
node -e 'console.log(new Date().toISOString())'
```

```
2026-09-28T09:04:13.850Z
HTTP/1.1 404 Not Found
x-request-id: 01a0e741-f233-7329-b0e0-5fd2a413d773
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 115
Date: Mon, 28 Sep 2026 09:04:13 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":404,"type":"about:blank#not-found","title":"Not Found","instance":"01a0e741-f233-7329-b0e0-5fd2a413d773"}
HTTP/1.1 404 Not Found
x-request-id: 01a0e741-f240-7a00-8b03-5531fda52ef8
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 115
Date: Mon, 28 Sep 2026 09:04:13 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"status":404,"type":"about:blank#not-found","title":"Not Found","instance":"01a0e741-f240-7a00-8b03-5531fda52ef8"}
2026-09-28T09:04:13.918Z
```

The admin API's audit trail for that window, read through the proxy on the
same session, is empty:

```bash
curl -sS -D - -b jar \
  'http://localhost:3000/console/api/admin/tenants/console-paths/audit?from=2026-09-28T09:04:13.850Z&to=2026-09-28T09:04:13.918Z'
```

```
HTTP/1.1 200 OK
x-request-id: 01a0e742-a8da-7abf-8bce-3c843cc365d0
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 12
Date: Mon, 28 Sep 2026 09:05:00 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}
```

An empty audit trail alone proves little, since a forwarded `GET` writes no
audit row. What does prove it is the server's request log, which records a
forwarded call as a request of its own. The proxy's `404` is byte-identical
to the one the gateway answers for an unknown `/console/api/` path, so a
third request shows which route took these paths: the same `%2e%2e` form,
resolving back inside `/admin/`, between two more timestamps.

```bash
node -e 'console.log(new Date().toISOString())'
curl --path-as-is -sS -D - -b jar \
  'http://localhost:3000/console/api/admin/%2e%2e/admin/tenants/console-paths/subjects?limit=1'
node -e 'console.log(new Date().toISOString())'
```

```
2026-09-28T09:04:42.087Z
HTTP/1.1 200 OK
x-request-id: 01a0e742-6084-7ca6-a3a2-815d725c5921
content-type: application/json; charset=utf-8
link: </console/api/admin/tenants/console-paths/subjects?limit=1&cursor=eyJhZnRlciI6IjAxYTBlNzJkLTViYTktNzhjZC1iODc3LTdlYTZkNDA3NjAyOCIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMGU3MmQtNTkyNy03M2MzLWIxNGQtYTViNjBkMWNhOWFkIiwiZmlsdGVycyI6IlQxUE5vWXdycWd3RFZMdGZtajdMNWUwU3EwMk9FYnFIUEM4UkZoSUN1VVUifQ.wxCYgMzM9KahHxwDlrS6SAK5sacypLuVFOf9quYa9S8>; rel="next"
cache-control: no-store
content-length: 465
Date: Mon, 28 Sep 2026 09:04:42 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0e72d-5ba9-78cd-b877-7ea6d4076028","type":"user","username":"grace","email":"grace@example.com","enabled":true,"created_at":"2026-09-28T08:41:44.607Z"}],"next":"eyJhZnRlciI6IjAxYTBlNzJkLTViYTktNzhjZC1iODc3LTdlYTZkNDA3NjAyOCIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMGU3MmQtNTkyNy03M2MzLWIxNGQtYTViNjBkMWNhOWFkIiwiZmlsdGVycyI6IlQxUE5vWXdycWd3RFZMdGZtajdMNWUwU3EwMk9FYnFIUEM4UkZoSUN1VVUifQ.wxCYgMzM9KahHxwDlrS6SAK5sacypLuVFOf9quYa9S8"}
2026-09-28T09:04:42.251Z
```

The request log for each window, the escapes' first:

```bash
docker logs --since 2026-09-28T09:04:13.850Z --until 2026-09-28T09:04:13.918Z docker-odudu-1 2>&1 \
  | jq -c 'select(.msg == "incoming request") | [.req.method, .req.url]'
docker logs --since 2026-09-28T09:04:42.087Z --until 2026-09-28T09:04:42.251Z docker-odudu-1 2>&1 \
  | jq -c 'select(.msg == "incoming request") | [.req.method, .req.url]'
```

```
["GET","/console/api/admin/%2e%2e/tenants/console-paths/protocol/openid-connect/token"]
["GET","/console/api/admin/../tenants/console-paths/protocol/openid-connect/token"]
```

```
["GET","/console/api/admin/%2e%2e/admin/tenants/console-paths/subjects"]
["GET","/admin/tenants/console-paths/subjects"]
```

The two escapes reached the server and nothing followed them. The third
request was followed by its forward to `/admin/`.
