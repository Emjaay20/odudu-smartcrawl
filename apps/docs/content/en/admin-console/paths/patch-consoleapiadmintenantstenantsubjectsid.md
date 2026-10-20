---
title: 'PATCH /console/api/admin/tenants/{tenant}/subjects/{id}'
description: "From the eighth run, on grace's session. If-Match is one of the four request headers the proxy forwards, and every write names the session's subject…"
---

## `PATCH /console/api/admin/tenants/{tenant}/subjects/{id}`

From the eighth run, on `grace`'s session. `If-Match` is one of the four
request headers the proxy forwards, and every write names the session's
subject in `X-Odudu-Console-Subject` ([below](./post-consoleapiadmintenantstenantsubjects-refused-for-another-principal.md#post-consoleapiadmintenantstenantsubjects-refused-for-another-principal)).
The `ETag` comes from a read of `hopper`:

```bash
curl -sS -D - -c jar -b jar -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects/01a13ff2-f33a-79ce-a952-0aeec04a80d4
```

```
HTTP/1.1 200 OK
x-request-id: 01a13ff3-38ca-7de2-b786-a50a8a02eaaa
content-type: application/json; charset=utf-8
etag: "476c7432885859a0124f9b8bd8ec8e643c33a66caccf17b6d0cf940c01a49e51"
cache-control: no-store
content-length: 163
Date: Thu, 15 Oct 2026 14:24:26 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a13ff2-f33a-79ce-a952-0aeec04a80d4","type":"user","username":"hopper","email":"hopper@example.com","enabled":true,"created_at":"2026-10-15T14:24:09.013Z"}
```

A write under `/console/api/` must carry the base's `Origin` and
`X-Odudu-Console: 1` (see the next section). This one changes `hopper`'s
address, on that `ETag`:

```bash
curl -sS -D - -c jar -b jar -X PATCH \
  -H 'Origin: http://localhost:3185' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "476c7432885859a0124f9b8bd8ec8e643c33a66caccf17b6d0cf940c01a49e51"' \
  -d '{"email":"grace.hopper@example.com"}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects/01a13ff2-f33a-79ce-a952-0aeec04a80d4
```

```
HTTP/1.1 200 OK
x-request-id: 01a13ff3-38fc-7a89-9c47-3fc41614c27a
content-type: application/json; charset=utf-8
etag: "6ab600b1d9d162c013b0b39cbe7f171e9f564d1b29a03049f9480e8a144f372c"
cache-control: no-store
content-length: 169
Date: Thu, 15 Oct 2026 14:24:26 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a13ff2-f33a-79ce-a952-0aeec04a80d4","type":"user","username":"hopper","email":"grace.hopper@example.com","enabled":true,"created_at":"2026-10-15T14:24:09.013Z"}
```

The same `If-Match` again, which that write made stale. The `412` is the
admin API's own, passed back unchanged. Its `instance` is the `x-request-id`
the browser was answered with, because the gateway sends that id upstream:

```bash
curl -sS -D - -c jar -b jar -X PATCH \
  -H 'Origin: http://localhost:3185' -H 'X-Odudu-Console: 1' \
  -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "476c7432885859a0124f9b8bd8ec8e643c33a66caccf17b6d0cf940c01a49e51"' \
  -d '{"enabled":false}' \
  http://localhost:3185/console/api/admin/tenants/console-paths/subjects/01a13ff2-f33a-79ce-a952-0aeec04a80d4
```

```
HTTP/1.1 412 Precondition Failed
x-request-id: 01a13ff3-3986-786b-8fac-4370a66c669f
content-type: application/problem+json; charset=utf-8
cache-control: no-store
content-length: 153
Date: Thu, 15 Oct 2026 14:24:27 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a13ff3-3986-786b-8fac-4370a66c669f"}
```

The write's audit row, read through the proxy for the second in which the
three requests ran (`2026-10-15T14:24:26Z`, printed by `date -u` before the
first), carries the `PATCH`'s own `x-request-id` as its `request_id`, and
answers `actor_name` and `actor_origin`:

```bash
curl -sS -D - -b jar -H 'X-Odudu-Console-Subject: 01a13ff2-eff9-746c-b8cb-e56af2072daa' \
  'http://localhost:3185/console/api/admin/tenants/console-paths/audit?from=2026-10-15T14:24:26Z&to=2026-10-15T14:24:27Z'
```

```
HTTP/1.1 200 OK
x-request-id: 01a13ff3-4d78-7651-ae8c-911d67e5da32
content-type: application/json; charset=utf-8
cache-control: no-store
content-length: 625
Date: Thu, 15 Oct 2026 14:24:32 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a13ff3-396e-72bc-b234-0c7b9ae6a6c6","occurred_at":"2026-10-15T14:24:26.970Z","event_type":"admin_mutation","action":"subject.amend","outcome":"allowed","actor_tenant_id":"01a13ff2-eddb-7d89-8555-c32d1cd8acf9","actor_subject_id":"01a13ff2-eff9-746c-b8cb-e56af2072daa","actor_client_id":"01a13ff2-ee18-7fab-b610-0fb99df8e511","actor_name":"grace","actor_origin":"tenant","resource_type":"subject","resource_id":"01a13ff2-f33a-79ce-a952-0aeec04a80d4","request_id":"01a13ff3-38fc-7a89-9c47-3fc41614c27a","ip":"172.20.0.1","detail":{"email":{"after":"grace.hopper@example.com","before":"hopper@example.com"}}}]}
```
