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
x-request-id: 01a0e72e-766f-72b0-a1cb-56965abcda92
content-type: application/json; charset=utf-8
link: </console/api/admin/tenants/console-paths/subjects?limit=1&cursor=eyJhZnRlciI6IjAxYTBlNzJkLTViYTktNzhjZC1iODc3LTdlYTZkNDA3NjAyOCIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMGU3MmQtNTkyNy03M2MzLWIxNGQtYTViNjBkMWNhOWFkIiwiZmlsdGVycyI6IlQxUE5vWXdycWd3RFZMdGZtajdMNWUwU3EwMk9FYnFIUEM4UkZoSUN1VVUifQ.wxCYgMzM9KahHxwDlrS6SAK5sacypLuVFOf9quYa9S8>; rel="next"
cache-control: no-store
content-length: 465
Date: Mon, 28 Sep 2026 08:42:57 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0e72d-5ba9-78cd-b877-7ea6d4076028","type":"user","username":"grace","email":"grace@example.com","enabled":true,"created_at":"2026-09-28T08:41:44.607Z"}],"next":"eyJhZnRlciI6IjAxYTBlNzJkLTViYTktNzhjZC1iODc3LTdlYTZkNDA3NjAyOCIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMGU3MmQtNTkyNy03M2MzLWIxNGQtYTViNjBkMWNhOWFkIiwiZmlsdGVycyI6IlQxUE5vWXdycWd3RFZMdGZtajdMNWUwU3EwMk9FYnFIUEM4UkZoSUN1VVUifQ.wxCYgMzM9KahHxwDlrS6SAK5sacypLuVFOf9quYa9S8"}
```

The admin API sent `Link: </admin/tenants/console-paths/subjects?…>`, and the
gateway rewrote it to `/console/api/admin/`. Following it through the proxy
reaches the second page. `$NEXT` is the path inside the `<…>` above.

```bash
curl -sS -D - -c jar -b jar "http://localhost:3000$NEXT"
```

```
HTTP/1.1 200 OK
x-request-id: 01a0e72e-769f-7f59-94db-cc4723f16d15
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 175
Date: Mon, 28 Sep 2026 08:42:57 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0e72d-7fc7-7950-a1e7-1d079588f8b4","type":"user","username":"hopper","email":"hopper@example.com","enabled":true,"created_at":"2026-09-28T08:41:53.858Z"}]}
```
