---
title: 'GET /subjects/:id/effective-roles'
description: 'Requires view-users. Every role the subject holds — the set token issuance and authorization read (effectiveRoles, @odudu/domain-authz), not only…'
---

# `GET /subjects/:id/effective-roles`

Requires `view-users`. Every role the subject holds — the set token issuance
and authorization read (`effectiveRoles`, `@odudu/domain-authz`), not only
what `GET /subjects/:id/roles` assigns — each with `via`, every path it is held
by: `direct`; `group`, naming the group the role is mapped to, which is the
subject's own or one of its ancestors; or `composite`, naming the held role
it is nested under. Paged in role id order, `limit` up to 200 and `link` and
`next` as `GET /subjects` carries them, since a subject can reach more roles
through groups and composites than any one assignment list holds; `via` is
worked out for the page's roles only, in a constant number of queries. It has
no `ETag`: `GET /subjects/:id/roles` is
the list `PUT /subjects/:id/roles` replaces, and this is what follows from it.
An unknown subject answers `404`.

After two tenant roles `billing-reader` and `billing-auditor`, a group
`/finance` with `/finance/payables` beneath it, and, through the endpoints
above, `billing-auditor` nesting `billing-reader`, `/finance` mapped to
`billing-reader`, `grace` assigned `billing-auditor` and made a member of
`/finance/payables`. Her assignments, then what she holds:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/roles"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/effective-roles"; echo
```

```
{"items":[{"id":"01a0ee8b-2f3b-769a-9d35-2cd69f7b8c23","name":"billing-auditor","client_id":null,"client_key":null}]}
{"items":[{"id":"01a0ee8b-2f1f-7484-9703-dfbd7e559f17","name":"billing-reader","client_id":null,"client_key":null,"via":[{"kind":"group","group_id":"01a0ee8b-2f54-7a5a-9da6-7ba6baacbe13","group_path":"/finance"},{"kind":"composite","parent_role_id":"01a0ee8b-2f3b-769a-9d35-2cd69f7b8c23","parent_name":"billing-auditor"}]},{"id":"01a0ee8b-2f3b-769a-9d35-2cd69f7b8c23","name":"billing-auditor","client_id":null,"client_key":null,"via":[{"kind":"direct"}]}]}
```

`billing-reader` is held twice over — through `/finance`, an ancestor of the
group she is in, and nested under `billing-auditor` — and her assignments
name neither.

## Paging what a subject holds

In `perf-demo` (`grace` assigned five tenant roles `role-reader`, `role-writer`,
`role-auditor`, `role-billing` and `role-ops`), two at a time:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/$G/effective-roles?limit=2"
```

```
HTTP/1.1 200 OK
x-request-id: 01a10f7e-2c5b-7c1d-88b0-0622d7c9fa00
cache-control: no-store
link: </admin/tenants/perf-demo/subjects/01a10f7d-bb83-7e78-ab4a-84756ef68b49/effective-roles?limit=2&cursor=eyJhZnRlciI6IjAxYTEwZjdlLTE4NDktNzY0MC1iZmQ2LTE5YThmZGY3YzA0NSIsImNvbGxlY3Rpb24iOiJlZmZlY3RpdmUtcm9sZXMiLCJ0ZW5hbnRJZCI6IjAxYTEwZjdkLWJiMGEtN2NhNy1iNGE1LTFmMTczNjA5YmZmNSIsImZpbHRlcnMiOiIyeXlYUlcwTFVqWkdra19nR29HdGVrLThCbTJ5RnoyT0lmb1lITUxRRVV3In0.CbEhjt6kfAHKMMl3V9_y4nRH3orhNcgZDKYzJT7wwN4>; rel="next"
content-type: application/json; charset=utf-8
content-length: 568

{"items":[{"id":"01a10f7e-1815-797f-8beb-a15490ebc8b1","name":"role-reader","client_id":null,"client_key":null,"via":[{"kind":"direct"}]},{"id":"01a10f7e-1849-7640-bfd6-19a8fdf7c045","name":"role-writer","client_id":null,"client_key":null,"via":[{"kind":"direct"}]}],"next":"eyJhZnRlciI6IjAxYTEwZjdlLTE4NDktNzY0MC1iZmQ2LTE5YThmZGY3YzA0NSIsImNvbGxlY3Rpb24iOiJlZmZlY3RpdmUtcm9sZXMiLCJ0ZW5hbnRJZCI6IjAxYTEwZjdkLWJiMGEtN2NhNy1iNGE1LTFmMTczNjA5YmZmNSIsImZpbHRlcnMiOiIyeXlYUlcwTFVqWkdra19nR29HdGVrLThCbTJ5RnoyT0lmb1lITUxRRVV3In0.CbEhjt6kfAHKMMl3V9_y4nRH3orhNcgZDKYzJT7wwN4"}
```
