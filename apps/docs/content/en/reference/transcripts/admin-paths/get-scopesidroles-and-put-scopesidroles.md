---
title: 'GET /scopes/:id/roles and PUT /scopes/:id/roles'
description: "Both require manage-tenant. The write replaces the scope's role mapping wholesale, the same replace-all shape PUT /groups/:id/roles uses."
---

# `GET /scopes/:id/roles` and `PUT /scopes/:id/roles`

Both require `manage-tenant`. The write replaces the scope's role mapping
wholesale, the same replace-all shape `PUT /groups/:id/roles` uses. An
unknown role id answers `400`, and the same `403` refuses a delta that adds
or leaves out a role reaching an admin capability the caller does not hold.

**`If-Match` is mandatory here, not optional.** This route replaces an
authorization-bearing list whole, so a stale write reinstates exactly what
another administrator has just removed; the header comes from the matching
`GET`, which answers an `ETag` over the same list. Absent, the request is
refused with `428 Precondition Required` and nothing is changed; stale,
with `412`. The list is read under the same lock the replacement runs
under, so two callers sent at once are serialised — the second sees what
the first wrote rather than matching the same pre-write state.

Each role carries `admin_reach`, what it reaches of the admin vocabulary
however deep it nests it, as a group's roles do: it is derived on every read
and outside the `ETag`, so the tag over the stored fields is the same before
and after a role's nesting changes. The console judges a role already mapped by
it.

Captured against the eighteenth stack, in `scope-reach-demo`, on a scope
`billing` (`01a12d29-72a6-77f6-9e8b-c2fcbb928cd2`) and two roles: the tenant role
`billing-viewer` (`01a12d29-72f8-74a0-a73a-0fa6dd6d4d76`) and the built-in
admin client's `view-audit` (`01a12d29-71bb-7e4c-91c8-845063e60e93`). The read
of the empty list, the write under its tag, and the read back, whose `etag`
is the write's:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-72a6-77f6-9e8b-c2fcbb928cd2/roles

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"' \
  -d '{"role_ids": ["01a12d29-72f8-74a0-a73a-0fa6dd6d4d76", "01a12d29-71bb-7e4c-91c8-845063e60e93"]}' \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-72a6-77f6-9e8b-c2fcbb928cd2/roles

curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-72a6-77f6-9e8b-c2fcbb928cd2/roles
```

```
HTTP/1.1 200 OK
x-request-id: 01a12d29-87a0-797a-8a23-e93b9d603bb1
cache-control: no-store
etag: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"
content-type: application/json; charset=utf-8
content-length: 12

{"items":[]}

HTTP/1.1 200 OK
x-request-id: 01a12d29-87fd-7315-8c85-41228d438cda
cache-control: no-store
etag: "164913dddef8ca9524b83eb1a02276e669aad0ce89edef3f05c68f1cd24dbcc9"
content-type: application/json; charset=utf-8
content-length: 306

{"items":[{"id":"01a12d29-71bb-7e4c-91c8-845063e60e93","name":"view-audit","client_id":"01a12d29-713b-7852-a836-47dc3d851563","client_key":"odudu-admin","admin_reach":["view-audit"]},{"id":"01a12d29-72f8-74a0-a73a-0fa6dd6d4d76","name":"billing-viewer","client_id":null,"client_key":null,"admin_reach":[]}]}

HTTP/1.1 200 OK
x-request-id: 01a12d29-8836-759c-a401-4f31b886a3d9
cache-control: no-store
etag: "164913dddef8ca9524b83eb1a02276e669aad0ce89edef3f05c68f1cd24dbcc9"
content-type: application/json; charset=utf-8
content-length: 306

{"items":[{"id":"01a12d29-71bb-7e4c-91c8-845063e60e93","name":"view-audit","client_id":"01a12d29-713b-7852-a836-47dc3d851563","client_key":"odudu-admin","admin_reach":["view-audit"]},{"id":"01a12d29-72f8-74a0-a73a-0fa6dd6d4d76","name":"billing-viewer","client_id":null,"client_key":null,"admin_reach":[]}]}
```
