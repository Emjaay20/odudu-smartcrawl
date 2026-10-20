---
title: 'GET /subjects/:id/roles and PUT /subjects/:id/roles'
description: 'The read requires view-users. The write requires manage-users, and enforces a capability ceiling beyond it: a caller may never assign authority it…'
---

## `GET /subjects/:id/roles` and `PUT /subjects/:id/roles`

The read requires `view-users`. The write requires `manage-users`, and
enforces a capability ceiling beyond it: a
caller may never assign authority it does not itself hold. The requested
role set and the caller's own are each expanded through `role_composites`
to the admin-client capability names they actually grant — not merely the
role names given — before the comparison, so a role that nests
`tenant-admin` rather than naming it cannot smuggle the assignment past a
name check. A caller whose expanded set is not a subset of its own is
refused with `403`; this is what stops `manage-users` alone from assigning
`tenant-admin` — or `manage-tenants` in the system tenant — to any subject,
itself included (CWE-269). Replaces the subject's role assignments
wholesale, the same convention `required-actions` follows: a role left out
is one the caller clears, and stops appearing in the subject's
`effectiveRoles` immediately. Before any of that, the target ceiling
([`POST /subjects/:id/password`](./post-subjectsidpassword.md#the-target-ceiling)) refuses a caller who
does not hold every capability the subject already holds — so an empty
list cannot demote a `tenant-admin` out from under the check that would
otherwise protect it.

**`If-Match` is mandatory here, not optional.** This route replaces an
authorization-bearing list whole, so a stale write reinstates exactly what
another administrator has just removed; the header comes from the matching
`GET`, which answers an `ETag` over the same list. Absent, the request is
refused with `428 Precondition Required` and nothing is changed; stale,
with `412`. The list is read under the same lock the replacement runs
under, so two callers sent at once are serialised — the second sees what
the first wrote rather than matching the same pre-write state.

Captured against the sixth stack, on a subject `grace` and a role
`billing-viewer` created in its `demo` for it. The read, then the write
carrying what the read answered:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3080/admin/tenants/demo/subjects/01a0ea58-0e2d-7c60-a4a2-7a7edc70a01f/roles

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"' \
  -d '{"role_ids": ["01a0ea58-0e45-76eb-be5f-bd76e03e4b6e"]}' \
  http://localhost:3080/admin/tenants/demo/subjects/01a0ea58-0e2d-7c60-a4a2-7a7edc70a01f/roles
```

```
HTTP/1.1 200 OK
x-request-id: 01a0ea58-0e51-7257-bf3c-64071dd43178
cache-control: no-store
etag: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"
content-type: application/json; charset=utf-8
content-length: 12
Date: Mon, 28 Sep 2026 23:27:14 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}

HTTP/1.1 200 OK
x-request-id: 01a0ea58-0e65-7ba5-836e-5afec260184a
cache-control: no-store
etag: "da18ee68fe8192f473f7a652ecf0a6643b7a07b68bd4bc028673d434328f8572"
content-type: application/json; charset=utf-8
content-length: 116
Date: Mon, 28 Sep 2026 23:27:14 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0ea58-0e45-76eb-be5f-bd76e03e4b6e","name":"billing-viewer","client_id":null,"client_key":null}]}
```

**The tag is over the list, not over the resource.** An empty assignment
hashes to `"eef46741…"` whichever subject, group or scope it belongs to —
the three sections that follow show the same value — so a tag is not an
identifier and carries no authority to write anywhere. It still does its
one job: a write only lands when the list is what its holder last read.

### The last administrator

A tenant always keeps one enabled subject holding `tenant-admin` — in the
system tenant, `manage-tenants`, whose holders reach every other tenant —
once it has one. A write that would leave none is refused with `409`,
type `about:blank#last-administrator`, nothing of it applied, and a
`refused` row under the action attempted (ADR 0037, ADR 0040's
amendment). Holders are counted however they hold it, and a disabled
subject is not one. The same refusal stands on every door that can take
an administrator away: this route and `PUT /subjects/:id/groups`,
disabling or deleting a subject, `PUT /groups/:id/roles`, reparenting or
deleting a group, deleting a role or removing a composite that nests it,
and deleting a client whose roles do. A tenant with no holder to begin
with is refused nothing.

Captured against the fifth stack in `admins-demo`, as `ada-t2`, on
`grace`, the tenant's only holder — her roles emptied under the `ETag` her
last write answered, then disabling her, then deleting her, then her
refused rows, newest first:

Recaptured against the tenth stack, once each row answered `actor_name` and
`actor_origin`, as `ada-t8b2`, on a `grace` seeded as the only holder of
`tenant-admin` in a tenant of the same name, her roles emptied under the
`ETag` a read of them answered, so the ids are that run's, not those above:

```bash
curl -sS -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -H 'If-Match: "ed3ace191e50ac13f9c21c9ec7f012d4155f16ce7ca3ea35698f18c9f25c3cd8"' \
  -d '{"role_ids":[]}' \
  http://localhost:3082/admin/tenants/admins-demo/subjects/01a0ee91-5901-7963-a2e4-c73142de6325/roles; echo
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"enabled":false}' \
  http://localhost:3082/admin/tenants/admins-demo/subjects/01a0ee91-5901-7963-a2e4-c73142de6325; echo
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/admins-demo/subjects/01a0ee91-5901-7963-a2e4-c73142de6325; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/admins-demo/audit?resource_type=subject&resource_id=01a0ee91-5901-7963-a2e4-c73142de6325&outcome=refused'; echo
```

```
{"type":"about:blank#last-administrator","title":"Conflict","status":409,"detail":"this would leave no enabled subject holding tenant-admin","instance":"01a0ee91-5c87-7b01-bee7-d60919b3f51a"}
{"type":"about:blank#last-administrator","title":"Conflict","status":409,"detail":"this would leave no enabled subject holding tenant-admin","instance":"01a0ee91-5ccd-7e16-b183-e33e0b17cee3"}
{"type":"about:blank#last-administrator","title":"Conflict","status":409,"detail":"this would leave no enabled subject holding tenant-admin","instance":"01a0ee91-5d11-7b93-acf2-8a3f1ac1ced3"}
{"items":[{"id":"01a0ee91-5d41-742d-8e36-8d689e236e62","occurred_at":"2026-09-29T19:08:19.116Z","event_type":"admin_mutation","action":"subject.delete","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee91-5901-7963-a2e4-c73142de6325","request_id":"01a0ee91-5d11-7b93-acf2-8a3f1ac1ced3","ip":"172.22.0.1","detail":{"reason":"this would leave no enabled subject holding tenant-admin"}},{"id":"01a0ee91-5cf2-7d9e-b589-044ea71896ad","occurred_at":"2026-09-29T19:08:19.040Z","event_type":"admin_mutation","action":"subject.amend","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee91-5901-7963-a2e4-c73142de6325","request_id":"01a0ee91-5ccd-7e16-b183-e33e0b17cee3","ip":"172.22.0.1","detail":{"reason":"this would leave no enabled subject holding tenant-admin"}},{"id":"01a0ee91-5cb4-72e7-aa73-3ead5e69f32c","occurred_at":"2026-09-29T19:08:18.980Z","event_type":"admin_mutation","action":"subject.roles_set","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee91-5901-7963-a2e4-c73142de6325","request_id":"01a0ee91-5c87-7b01-bee7-d60919b3f51a","ip":"172.22.0.1","detail":{"reason":"this would leave no enabled subject holding tenant-admin"}}]}
```

The group, role and client doors, the system tenant's `manage-tenants`,
and two removals racing each other are what
`packages/protocol-admin/tests/administrators.int.test.ts` shows; none of
those was captured here.

### The size of a replacement

Every `PUT` that replaces a set — a subject's roles and groups, a group's roles,
a scope's roles — refuses more than 200 ids with `400`, before it reads
anything, so the set a `GET` answers and an `ETag` hashes is never larger than
a page. Against the same stack as the other transcripts of this increment
(`perf-demo`), 201 random ids:

```bash
curl -sS -D - -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' -H "If-Match: $ETAG" \
  -d "{\"role_ids\":[$IDS_201]}" "$P/subjects/$G/roles"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a10f7e-686f-7945-ac8b-8037916ab1d3
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 237

{"type":"about:blank","title":"Error","status":400,"detail":"body/role_ids must NOT have more than 200 items","errors":[{"path":"role_ids","message":"must NOT have more than 200 items"}],"instance":"01a10f7e-686f-7945-ac8b-8037916ab1d3"}
```
