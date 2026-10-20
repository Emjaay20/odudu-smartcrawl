---
title: 'GET /admin/tenants'
description: 'Lists tenants — every one, the system tenant included: hiding it would make the one tenant an operator most needs to inspect the one they cannot.'
---

# `GET /admin/tenants`

Lists tenants — every one, the `system` tenant included: hiding it would
make the one tenant an operator most needs to inspect the one they cannot.
Requires `manage-tenants`, which only a system admin holds, so this is the
one collection with no tenant-local view. Pages by an opaque cursor, `?limit=`
and `?cursor=`, ordered by `id`; a further page is announced by a
`Link: rel="next"` header and a `next` member in the body, both absent once
the collection fits in one page. The response carries no total;
`GET /admin/tenants/count` below answers one.

**Search** works the way `GET /subjects` below describes it: a prefix of one
named field, `?name=` or `?display_name=`, never both, folded by
PostgreSQL's `lower()` and matched as a range over the stored `name_search`
and `display_name_search` columns (`0074_list_indexes_tenants_clients.sql`),
so `%`, `_` and `\` are ordinary characters. A searched listing is ordered
by that folded column, then by `id`; a tenant with no display name never
matches `?display_name=`. **`?enabled=true|false`** is the one exact filter,
`AND`ed with a search. A cursor is bound to every filter it was minted
under, and any other parameter is refused with `400` naming it.

```bash
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants?limit=50"
```

Captured after `POST /admin/tenants` below had created `demo`, so both
tenants this stack ever held are in it — the collection fits one page, and
there is no `next`:

```
{"items":[{"id":"0199aa00-0000-7000-8000-000000000001","name":"system","display_name":"System","enabled":true,"created_at":"2026-09-25T05:12:51.138Z"},{"id":"01a0d6fc-3626-7e23-94d7-3b1b666e278f","name":"demo","display_name":"Demo","enabled":true,"created_at":"2026-09-25T05:14:08.294Z"}]}
```

The searches below ran against the sixth stack (the note at the top of
this document), as `ada`. Its tenants were `acme`, `demo`, `etags-demo`,
`register-audit`, `registration-audit`, `reset-audit`, `signup-audit` and
`system`, only `system` carrying a display name. `RE` finds three, in
folded order:

```bash
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?name=RE"
```

```
{"items":[{"id":"01a0ea4d-1647-757b-8635-57ab1ac4d518","name":"register-audit","display_name":null,"enabled":true,"created_at":"2026-09-28T23:15:15.656Z"},{"id":"01a0ea4d-167d-7480-af45-b58c2bf96cbf","name":"registration-audit","display_name":null,"enabled":true,"created_at":"2026-09-28T23:15:15.709Z"},{"id":"01a0ea4d-16b5-70ca-8567-d7268cbcbe18","name":"reset-audit","display_name":null,"enabled":true,"created_at":"2026-09-28T23:15:15.766Z"}]}
```

One at a time, the `Link` header carries the search forward:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?name=re&limit=1"
```

```
HTTP/1.1 200 OK
x-request-id: 01a0ea4d-1731-7ef6-9357-282bc886419b
cache-control: no-store
link: </admin/tenants?limit=1&name=re&cursor=eyJhZnRlciI6IjAxYTBlYTRkLTE2NDctNzU3Yi04NjM1LTU3YWIxYWM0ZDUxOCIsInNvcnQiOiJyZWdpc3Rlci1hdWRpdCIsImNvbGxlY3Rpb24iOiJ0ZW5hbnRzIiwidGVuYW50SWQiOiIwMTk5YWEwMC0wMDAwLTcwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJmaWx0ZXJzIjoiMUo1ZVF0UmJjX2QtVnhmRjUzNEUzekYtbDVwMGZfVUxMa0JWRm1xNXVjWSJ9.T5n5x7r9Ix4tq2JdXPzmt4YrS9wiWceZ6I4DKVFub3Y>; rel="next"
content-type: application/json; charset=utf-8
content-length: 478
Date: Mon, 28 Sep 2026 23:15:15 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0ea4d-1647-757b-8635-57ab1ac4d518","name":"register-audit","display_name":null,"enabled":true,"created_at":"2026-09-28T23:15:15.656Z"}],"next":"eyJhZnRlciI6IjAxYTBlYTRkLTE2NDctNzU3Yi04NjM1LTU3YWIxYWM0ZDUxOCIsInNvcnQiOiJyZWdpc3Rlci1hdWRpdCIsImNvbGxlY3Rpb24iOiJ0ZW5hbnRzIiwidGVuYW50SWQiOiIwMTk5YWEwMC0wMDAwLTcwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJmaWx0ZXJzIjoiMUo1ZVF0UmJjX2QtVnhmRjUzNEUzekYtbDVwMGZfVUxMa0JWRm1xNXVjWSJ9.T5n5x7r9Ix4tq2JdXPzmt4YrS9wiWceZ6I4DKVFub3Y"}
```

Following that link, then replaying its cursor with `?enabled=true` added:

```bash
CURSOR='eyJhZnRlciI6IjAxYTBlYTRkLTE2NDctNzU3Yi04NjM1LTU3YWIxYWM0ZDUxOCIsInNvcnQiOiJyZWdpc3Rlci1hdWRpdCIsImNvbGxlY3Rpb24iOiJ0ZW5hbnRzIiwidGVuYW50SWQiOiIwMTk5YWEwMC0wMDAwLTcwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJmaWx0ZXJzIjoiMUo1ZVF0UmJjX2QtVnhmRjUzNEUzekYtbDVwMGZfVUxMa0JWRm1xNXVjWSJ9.T5n5x7r9Ix4tq2JdXPzmt4YrS9wiWceZ6I4DKVFub3Y'
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?limit=1&name=re&cursor=$CURSOR"
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?limit=1&name=re&enabled=true&cursor=$CURSOR"
```

```
{"items":[{"id":"01a0ea4d-167d-7480-af45-b58c2bf96cbf","name":"registration-audit","display_name":null,"enabled":true,"created_at":"2026-09-28T23:15:15.709Z"}],"next":"eyJhZnRlciI6IjAxYTBlYTRkLTE2N2QtNzQ4MC1hZjQ1LWI1OGMyYmY5NmNiZiIsInNvcnQiOiJyZWdpc3RyYXRpb24tYXVkaXQiLCJjb2xsZWN0aW9uIjoidGVuYW50cyIsInRlbmFudElkIjoiMDE5OWFhMDAtMDAwMC03MDAwLTgwMDAtMDAwMDAwMDAwMDAxIiwiZmlsdGVycyI6IjFKNWVRdFJiY19kLVZ4ZkY1MzRFM3pGLWw1cDBmX1VMTGtCVkZtcTV1Y1kifQ.3HZZKoeW5A2l6WNkxkBsTcirmh8ygRRWXa0lJ5GNs9g"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"cursor is invalid or expired","errors":[{"path":"cursor","message":"is invalid or expired"}],"instance":"01a0ea4d-177f-7a25-9ea3-ba5cf205d873"}
```

`?display_name=SYS`, then three refusals: two search fields at once (the
handler's), an `enabled` that is not `true` or `false`, and an unknown
parameter (both the generated schema's):

```bash
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?display_name=SYS"
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?name=a&display_name=b"
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?enabled=yes"
curl -sS \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants?search=demo"
```

```
{"items":[{"id":"0199aa00-0000-7000-8000-000000000001","name":"system","display_name":"System","enabled":true,"created_at":"2026-09-28T23:13:57.123Z"}]}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"search one field at a time: name or display_name, not both","errors":[{"path":"display_name","message":"search one field at a time: name or display_name, not both"}],"instance":"01a0ea4d-17a9-7246-9f2e-e0159658eb36"}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/enabled must be equal to one of the allowed values","errors":[{"path":"enabled","message":"must be equal to one of the allowed values"}],"instance":"01a0ea4d-17bd-7645-b759-17bea0c113d6"}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring must NOT have additional properties: search","errors":[{"path":"search","message":"must NOT have additional properties"}],"instance":"01a0ea4d-17c7-716b-9c2e-ef4188a269d2"}
```
