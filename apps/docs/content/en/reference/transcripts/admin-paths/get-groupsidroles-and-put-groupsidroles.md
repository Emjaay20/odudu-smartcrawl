---
title: 'GET /groups/:id/roles and PUT /groups/:id/roles'
description: "Both require manage-tenant. The write replaces the group's role mapping wholesale — a role left out of the list is one the caller clears, not one…"
---

# `GET /groups/:id/roles` and `PUT /groups/:id/roles`

Both require `manage-tenant`. The write replaces the group's role mapping
wholesale — a role left out of the list is one the caller clears, not one
left alone — the same replace-all shape `PUT /subjects/:id/roles` uses for
a subject's own assignments. An unknown role id answers `400`, and `403`
refuses a replacement whose **delta** reaches past the caller's own
capabilities: a role it adds, or a role it leaves out. A role kept in both
lists is not counted, so an administrator short of `tenant-admin` may add a
role beside it on a group mapped to it, and may not take it away.

**`If-Match` is mandatory here, not optional.** This route replaces an
authorization-bearing list whole, so a stale write reinstates exactly what
another administrator has just removed; the header comes from the matching
`GET`, which answers an `ETag` over the same list. Absent, the request is
refused with `428 Precondition Required` and nothing is changed; stale,
with `412`. The list is read under the same lock the replacement runs
under, so two callers sent at once are serialised — the second sees what
the first wrote rather than matching the same pre-write state.

On `demo`'s `engineering` group from the search above, a role `billing-viewer`
made there first, and `auditor`, a tenant role nesting `odudu-admin:view-audit`,
made there with `POST /roles` and `POST /roles/:id/composites`. Each role in the
answer carries its own `admin_reach`, so a page judging a change to the mapping
reads one answer, not one role at a time:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "billing-viewer"}' \
  http://localhost:3082/admin/tenants/demo/roles
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/demo/groups/01a10bd5-dd65-7a80-911a-cc2c507e344a/roles
curl -sS -D - -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"' \
  -d '{"role_ids": ["01a10bd5-de6e-7d18-9b8b-a05afda127f4", "01a10bd5-de26-730e-a24d-632a39dce6d1"]}' \
  http://localhost:3082/admin/tenants/demo/groups/01a10bd5-dd65-7a80-911a-cc2c507e344a/roles
```

```
{"id":"01a10bd5-de6e-7d18-9b8b-a05afda127f4","name":"billing-viewer","description":null,"client_id":null,"client_key":null,"default_for_new_subjects":false,"created_at":"2026-10-05T11:32:07.918Z","admin_reach":[]}
HTTP/1.1 200 OK
x-request-id: 01a10bd5-de7e-7fcd-b562-696280a5669c
cache-control: no-store
etag: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"
content-type: application/json; charset=utf-8
content-length: 12
Date: Mon, 05 Oct 2026 11:32:07 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}
HTTP/1.1 200 OK
x-request-id: 01a10bd5-de99-75e5-a726-7d31cf47b705
cache-control: no-store
etag: "8cbd27e13aebad32e9e6ea5227559c618a61a1407f780d5f503373664b63563c"
content-type: application/json; charset=utf-8
content-length: 260
Date: Mon, 05 Oct 2026 11:32:07 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a10bd5-de26-730e-a24d-632a39dce6d1","name":"auditor","client_id":null,"client_key":null,"admin_reach":["view-audit"]},{"id":"01a10bd5-de6e-7d18-9b8b-a05afda127f4","name":"billing-viewer","client_id":null,"client_key":null,"admin_reach":[]}]}
```

## A removal is judged by what it removes

**A write that takes an admin capability away from whoever holds it through
a group, a role, a scope or a client's roles is refused unless the caller
holds that capability.** The reach is what the removed edge or row carries,
expanded through `role_composites` the way every ceiling here expands it,
and it is judged without enumerating the subjects affected. Seven doors:

- `PUT /groups/:id/roles` and `PUT /scopes/:id/roles`, on the roles the new
  list leaves out.
- `DELETE /groups/:id`, on every role mapped to the group, to anything in
  its subtree, and to anything above it, since the subtree's members lose
  all of them.
- `PATCH /groups/:id` with a new `parent_id`, on what the old parent's
  chain handed the group, alongside the ceiling on what the new one hands it.
- `DELETE /roles/:id`, on what the role reaches.
- `DELETE /roles/:id/composites/:childId`, on what the child reaches.
- `DELETE /scopes/:id`, on the roles the scope maps, which the cascade
  takes with it.
- `DELETE /clients/:id`, on every role scoped to the client:
  `roles_client_fk` cascades, so each goes with the client, and with it
  every grant and composite edge naming it.

Without it, a caller holding `manage-tenant` alone could strip
`tenant-admin` from every member of a group mapped to it, although it could
neither grant it nor act on one of those members directly. The refusal is a
`403` naming what the caller lacks — "this removes capabilities the caller
does not hold", apart from what a write would grant, which a reparent or a
replacement names first — and a `refused` row with `detail.denied` under the
action attempted.

In a tenant `ceiling-removal` created for it. `admins` is a group mapped to
`tenant-admin`, with `on-call` beneath it; `ops-bundle` is a tenant role nesting
`tenant-admin`; `ops` is a scope mapped to it; and `bundle-app` is a client with
a role `operator` scoped to it, nesting `tenant-admin`. `bundle-app` was created
through `POST /clients`, `ops` through `POST /scopes`, `operator` through `POST
/roles` scoped to `bundle-app`, and `tenant-admin` nested under `operator`
through `POST /roles/:id/composites`, all against `ceiling-removal`.
`$TENANT_TOKEN` and `$CLIENTS_TOKEN` are the `client_credentials` tokens of two
clients whose service accounts were given `manage-tenant` alone and
`manage-clients` alone. Emptying `admins`, deleting it, moving `on-call` out
from under it, deleting `ops-bundle`, taking `tenant-admin` out of it, deleting
`ops` and deleting `bundle-app` are each refused, and the rows since `RUN_START`
are those seven:

```bash
RUN_START=$(date -u +%FT%T.000Z)
T=http://localhost:3000/admin/tenants/ceiling-removal
ADMINS=$T/groups/01a0e59a-b40e-70ab-a0d2-6aee1c1e9e6c
BUNDLE=$T/roles/01a0e59a-b48d-7b81-b9df-2bf4509c07d5
ETAG=$(curl -sS -D - -o /dev/null -H "Authorization: Bearer $TENANT_TOKEN" "$ADMINS/roles" | tr -d '\r' | sed -n 's/^etag: //p')
curl -sS -X PUT -H "Authorization: Bearer $TENANT_TOKEN" -H 'content-type: application/json' \
  -H "If-Match: $ETAG" -d '{"role_ids":[]}' "$ADMINS/roles"
echo
curl -sS -X DELETE -H "Authorization: Bearer $TENANT_TOKEN" "$ADMINS"
echo
curl -sS -X PATCH -H "Authorization: Bearer $TENANT_TOKEN" -H 'content-type: application/json' \
  -d '{"parent_id":null}' "$T/groups/01a0e59a-b430-7684-b079-11c1abfaafa3"
echo
curl -sS -X DELETE -H "Authorization: Bearer $TENANT_TOKEN" "$BUNDLE"
echo
curl -sS -X DELETE -H "Authorization: Bearer $TENANT_TOKEN" \
  "$BUNDLE/composites/01a0e59a-b2d6-7148-a179-a3cff021a673"
echo
curl -sS -X DELETE -H "Authorization: Bearer $TENANT_TOKEN" "$T/scopes/01a0e5f1-d296-7db2-95b9-2ff0f71bc6bf"
echo
curl -sS -X DELETE -H "Authorization: Bearer $CLIENTS_TOKEN" "$T/clients/01a0e5f1-d240-7325-9d2e-3385c81046b6"
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$T/audit?outcome=refused&from=$RUN_START" \
  | jq -c '.items[] | {action, resource_type, resource_id, detail}'
```

```
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-4f98-7076-a47d-70cfc175c24c"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-4fb4-74a1-aebe-ef66241284a1"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-4fcf-75f1-b711-ceff3dbb7948"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-4fea-780b-b058-171cdb51d3b3"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-5002-7eff-875f-c6ce20c07899"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-501b-773e-802b-d227ea8c5008"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"this removes capabilities the caller does not hold: tenant-admin, view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0e5f2-5031-728d-847e-2a621cba1062"}
{"action":"client.delete","resource_type":"client","resource_id":"01a0e5f1-d240-7325-9d2e-3385c81046b6","detail":{"denied":["tenant-admin","view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}}
{"action":"scope.delete","resource_type":"scope","resource_id":"01a0e5f1-d296-7db2-95b9-2ff0f71bc6bf","detail":{"denied":["tenant-admin","view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
{"action":"role.composite_remove","resource_type":"role","resource_id":"01a0e59a-b48d-7b81-b9df-2bf4509c07d5","detail":{"denied":["tenant-admin","view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"],"child_role_id":"01a0e59a-b2d6-7148-a179-a3cff021a673"}}
{"action":"role.delete","resource_type":"role","resource_id":"01a0e59a-b48d-7b81-b9df-2bf4509c07d5","detail":{"denied":["tenant-admin","view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
{"action":"group.amend","resource_type":"group","resource_id":"01a0e59a-b430-7684-b079-11c1abfaafa3","detail":{"denied":["tenant-admin","view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
{"action":"group.delete","resource_type":"group","resource_id":"01a0e59a-b40e-70ab-a0d2-6aee1c1e9e6c","detail":{"denied":["tenant-admin","view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
{"action":"group.roles_set","resource_type":"group","resource_id":"01a0e59a-b40e-70ab-a0d2-6aee1c1e9e6c","detail":{"denied":["tenant-admin","view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
```
