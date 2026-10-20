---
title: 'GET /scopes/:id/clients'
description: "Requires manage-tenant, the capability that arranges scopes — not the manage-clients a client's own representation needs."
---

## `GET /scopes/:id/clients`

Requires `manage-tenant`, the capability that arranges scopes — not the
`manage-clients` a client's own representation needs. It answers the
clients the scope is assigned to, each by its row id, its `client_id`, its
name and its `assignment`, and nothing else of the client, for the same
reason `PUT /scopes/:id/clients/:clientId` answers only the assignments.
The list is in row-id order and pages the way every list here does; a
cursor is bound to its scope, so one minted for another scope is refused
with `400`. An unknown scope, or another tenant's, answers `404`.

Captured against the fifth stack in `etags-demo`, on the scope `billing`
(`01a0e9ec-d68e-7463-8023-bd155594d026`), after a second public client
`etags-reports` was created there and assigned it as `default` — so two
clients carry it, `etags-app` as `optional` from the capture under
"The client's new `ETag`" below, which ran first. As `ada-t2`, who holds every capability; that `manage-tenant` alone
suffices is what `packages/protocol-admin/tests/scopes.int.test.ts` shows,
and was not captured:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3080/admin/tenants/etags-demo/scopes/01a0e9ec-d68e-7463-8023-bd155594d026/clients?limit=1'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/etags-demo/scopes/01a0e9ec-d68e-7463-8023-bd155594d026/clients?limit=1&cursor=$NEXT"
```

The first page's status line, `link` header and body, then the second page
under the `next` it answered:

```
HTTP/1.1 200 OK
link: </admin/tenants/etags-demo/scopes/01a0e9ec-d68e-7463-8023-bd155594d026/clients?limit=1&cursor=eyJhZnRlciI6IjAxYTBlOWVjLWQ2NGEtN2Q1ZC1hMGFjLWEwMWVmZDU2YjZmMyIsImNvbGxlY3Rpb24iOiJzY29wZV9jbGllbnRzIiwidGVuYW50SWQiOiIwMWEwZTllYy02MzM2LTdmNWQtYjY2NS0xZjBmMjM4NjkxZTAiLCJmaWx0ZXJzIjoienBYT015WjR3UTUxdlVWRlNlUUFSczUzM195TFYxRHo4VjhtSkJqaVV1VSJ9.kqsvXe4098QtAd3VtUADUklyypfRG7HebjhmN4KhHiw>; rel="next"
{"items":[{"id":"01a0e9ec-d64a-7d5d-a0ac-a01efd56b6f3","client_id":"etags-app","name":"etags-app","assignment":"optional"}],"next":"eyJhZnRlciI6IjAxYTBlOWVjLWQ2NGEtN2Q1ZC1hMGFjLWEwMWVmZDU2YjZmMyIsImNvbGxlY3Rpb24iOiJzY29wZV9jbGllbnRzIiwidGVuYW50SWQiOiIwMWEwZTllYy02MzM2LTdmNWQtYjY2NS0xZjBmMjM4NjkxZTAiLCJmaWx0ZXJzIjoienBYT015WjR3UTUxdlVWRlNlUUFSczUzM195TFYxRHo4VjhtSkJqaVV1VSJ9.kqsvXe4098QtAd3VtUADUklyypfRG7HebjhmN4KhHiw"}
{"items":[{"id":"01a0e9fc-fdef-7181-9a3d-25e1f12431e7","client_id":"etags-reports","name":"etags-reports","assignment":"default"}]}
```
