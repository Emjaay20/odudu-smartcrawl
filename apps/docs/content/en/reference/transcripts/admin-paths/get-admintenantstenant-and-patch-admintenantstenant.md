---
title: 'Read and amend a tenant'
description: 'Both require manage-tenant on the tenant named in the path — the tenant itself, not the collection, so a tenant-local admin reaches its own and a…'
---

# Read and amend a tenant

This page covers `GET /admin/tenants/{tenant}` and `PATCH /admin/tenants/{tenant}`.

Both require `manage-tenant` on the tenant named in the path — the tenant
itself, not the collection, so a tenant-local admin reaches its own and a
system admin reaches any tenant's by holding `manage-tenant` there too.
The `GET` answers the same shape `GET /admin/tenants` lists, with an
`ETag` over it; the `PATCH` accepts `If-Match` and answers `412` on a
mismatch, the same optional concurrency control `PATCH /settings` uses.

Two fields amend: `display_name` and `enabled`. Everything else is refused
with `400` carrying its reason, `name` most of all — it is already in the
issuer URL of every token this tenant has minted and in the path of every
request addressed to it, so renaming through a general amendment would
orphan both. That is a decision rather than a gap, and ADR 0039 makes it
permanent: a rename that reissued nothing would leave every relying party's
configured issuer pointing at a tenant that no longer answers. The refusal
names the way to do it instead — create a new tenant, export this one and
import it under the new name.

`enabled: false` is how a tenant is taken out of service without deleting
it: its own administrators stop authenticating, so the flag is not one to
set from a token issued by the tenant being disabled. On the **system**
tenant it is refused with `409` — every cross-tenant administrator
authenticates there, so disabling it would lock the whole deployment's
administration out with `psql` the only way back, the same reasoning that
guards the built-in admin client. Once a disable
has committed, every live session the tenant holds is ended, 500 to a
transaction, each batch queueing a Back-Channel Logout Token for each client
that registered a URI and writing a `session.end_all` row — the precondition
`DELETE /admin/tenants/{tenant}` below refuses without, which describes the
batches. Sending `{"enabled": false}` to a tenant already disabled ends any
session still live. `PATCH /settings` with `{"enabled": false}` does the same.
Re-enabling restores nothing.

On the `showcase` tenant `POST /admin/tenants` created there with `display_name:
"Showcase"`. The read, then an amendment, then the two refusals:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3080/admin/tenants/showcase
```

```
HTTP/1.1 200 OK
x-request-id: 01a0ea4e-884f-7a0a-8f24-30731b9da1ec
cache-control: no-store
etag: "2d683197c5f4fe27d0a0d6521f2038605964ad36a6d949d9962050fe63c463dd"
content-type: application/json; charset=utf-8
content-length: 144
Date: Mon, 28 Sep 2026 23:16:50 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0ea4d-c75e-7ac7-abe7-cdb5a6b2bbad","name":"showcase","display_name":"Showcase","enabled":true,"created_at":"2026-09-28T23:16:00.990Z"}
```

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"display_name": "Showcase Holdings"}' \
  http://localhost:3080/admin/tenants/showcase

curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"name": "showcase-2"}' \
  http://localhost:3080/admin/tenants/showcase

curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"enabled": false}' \
  http://localhost:3080/admin/tenants/system
```

```
{"id":"01a0ea4d-c75e-7ac7-abe7-cdb5a6b2bbad","name":"showcase","display_name":"Showcase Holdings","enabled":true,"created_at":"2026-09-28T23:16:00.990Z"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"name: name is already in the issuer URL of every token this tenant has minted, and in the path of every admin and protocol request addressed to it; a rename is not offered, by ADR 0039: create a new tenant, export this one and import it under the new name","errors":[{"path":"name","message":"name is already in the issuer URL of every token this tenant has minted, and in the path of every admin and protocol request addressed to it; a rename is not offered, by ADR 0039: create a new tenant, export this one and import it under the new name"}],"instance":"01a17adf-7d35-796f-b3f2-a7ecb2e9907f"}
{"type":"about:blank","title":"Conflict","status":409,"detail":"system is the tenant every cross-tenant administrator authenticates against and cannot be disabled","instance":"01a0ea4e-abfd-77ec-8f27-a082041215b6"}
```

Replaying the `ETag` from the read above — one generation stale after the
amendment — is refused and changes nothing:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "If-Match: $ETAG" -H "Content-Type: application/json" \
  -d '{"display_name": "Showcase Again"}' \
  http://localhost:3080/admin/tenants/showcase
```

```
{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a0ea4e-ac11-7806-9118-fbea0bdb05e3"}
```

The name refusal's text was changed after the transcript above was recorded: a
rename is not offered, permanently, by ADR 0039, and the refusal now says so
rather than pointing at an operation that will never exist. The tenant's and,
for the same reason, a group's:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"name": "ops-demo-2"}' \
  http://localhost:3082/admin/tenants/ops-demo; echo
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"name": "finance-2"}' \
  http://localhost:3082/admin/tenants/ops-demo/groups/01a0ee8b-2f54-7a5a-9da6-7ba6baacbe13; echo
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"name: name is already in the issuer URL of every token this tenant has minted, and in the path of every admin and protocol request addressed to it; a rename is not offered, by ADR 0039: create a new tenant, export this one and import it under the new name","errors":[{"path":"name","message":"name is already in the issuer URL of every token this tenant has minted, and in the path of every admin and protocol request addressed to it; a rename is not offered, by ADR 0039: create a new tenant, export this one and import it under the new name"}],"instance":"01a0ee9e-a4d8-72b1-9896-b14ad3d19376"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"name: name is embedded in every descendant path and in the groups claim a relying party matches on; a rename is not offered, by ADR 0039: create a new group and move its members","errors":[{"path":"name","message":"name is embedded in every descendant path and in the groups claim a relying party matches on; a rename is not offered, by ADR 0039: create a new group and move its members"}],"instance":"01a0ee9e-a4ed-7b89-9fdd-193dd93a8064"}
```
