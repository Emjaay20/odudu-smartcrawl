---
title: 'POST /roles/:id/composites'
description: 'Requires manage-tenant, and enforces the same capability ceiling PUT /subjects/:id/roles does: nesting child_role_id under the role named by :id…'
---

## `POST /roles/:id/composites`

Requires `manage-tenant`, and enforces the same capability ceiling
`PUT /subjects/:id/roles` does: nesting `child_role_id` under the role
named by `:id` must never hand that role a capability the caller does not
itself hold, checked by expanding `child_role_id` through
`role_composites` (`rolesReachableFrom`,
`packages/domain-authz/src/repository/effective-roles.ts`) rather than
comparing names, so a composite that nests a capability instead of naming
it cannot smuggle the escalation past a check on the request body. A cycle
— nesting a role under one it already (transitively) contains — answers
`409` rather than the generic `500` a raw constraint violation would leave
this as; `role_composite_cycle` is raised and caught in the domain
(`roleRepository.addComposite`, `packages/domain-authz/src/repository/roles.ts`),
never re-derived here. Nesting any admin capability at all under a role a
default role reaches is refused with `403` too, whoever the caller is —
see `PUT /roles/:id/default` below. **Nothing is nested under a capability
role** — a role of the tenant's built-in admin client — whoever the caller
is: `409`, naming the role, and a `refused` row with `detail.reason`. Its
shape is what provisioning gives it (`capabilityRoleGraph`), and since
`DELETE …/composites` refuses to take an edge off one, an edge added there
could never be removed, and would reach every holder of the capability.
Captured against `ceiling-removal` from
[a removal is judged by what it removes](./get-groupsidroles-and-put-groupsidroles.md#a-removal-is-judged-by-what-it-removes),
as the system administrator, nesting a plain tenant role `readers` under
`view-users`; its composites stay empty:

```bash
RUN_START=$(date -u +%FT%T.000Z)
VIEW_USERS=http://localhost:3000/admin/tenants/ceiling-removal/roles/01a0e59a-b2da-713f-9ec0-0e88fc6ac35f
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"child_role_id":"01a0e5a6-f033-7ee3-8cae-d2a498d8e5ae"}' "$VIEW_USERS/composites"
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$VIEW_USERS/composites"
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/ceiling-removal/audit?action=role.composite_add&resource_type=role&resource_id=01a0e59a-b2da-713f-9ec0-0e88fc6ac35f&from=$RUN_START" \
  | jq -c '.items[] | {action, outcome, detail}'
```

```
{"type":"about:blank","title":"Conflict","status":409,"detail":"view-users is a capability of odudu-admin, this tenant's built-in admin client, and nothing is nested under a capability role","instance":"01a0e5a7-1b07-786a-ab97-05e7b15f8a90"}
{"items":[]}
{"action":"role.composite_add","outcome":"refused","detail":{"reason":"view-users is a capability of odudu-admin, this tenant's built-in admin client, and nothing is nested under a capability role"}}
```

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_role_id": "01a0ea58-0e45-76eb-be5f-bd76e03e4b6e"}' \
  http://localhost:3080/admin/tenants/demo/roles/01a0ea62-7fb3-79e7-b158-93f29fa138ec/composites
```

`billing-viewer` nested under a second role, `billing-admin`, then the
reverse nesting attempted on the pair that now exists. Captured against
the sixth stack's `demo`; the `etag` is the one `GET …/composites` answers
for `billing-admin` afterwards:

```
HTTP/1.1 204 No Content
x-request-id: 01a0ea62-7fc0-7231-a08d-857d656c231a
cache-control: no-store
etag: "1ba3f58b74c652dfe778fc6ad685931d85d42696312ad3fa17e1b8d5c3e1b393"
Date: Mon, 28 Sep 2026 23:38:38 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Conflict","status":409,"detail":"would create a role composite cycle","instance":"01a0ea62-7fdd-7315-8c7b-657bb3fb2b79"}
```

### How many a role nests

A role nests at most 200 composites, the size of the set `GET` returns whole.
On `perf-demo`, after 200 `POST`s naming `kid-1` to `kid-200` under
`parent-role-b`, the 201st:

```bash
curl -sS -D - -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"child_role_id\":\"$KID_201\"}" "$P/roles/$PARENT/composites"
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a10f7f-293d-76a0-ba3e-cc037c7c8436
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 151

{"type":"about:blank","title":"Conflict","status":409,"detail":"a role nests at most 200 composites","instance":"01a10f7f-293d-76a0-ba3e-cc037c7c8436"}
```
