---
title: 'GET /subjects/:id/groups and PUT /subjects/:id/groups'
description: 'The read requires view-users; the write requires manage-users.'
---

# `GET /subjects/:id/groups` and `PUT /subjects/:id/groups`

The read requires `view-users`; the write requires `manage-users`. Both
answer the groups the subject **directly** belongs to — the same set the
`groups` claim of its next token carries
([ADR 0022](https://github.com/wizzywit/odudu/blob/main/docs/adr/0022-group-claims-carry-direct-memberships.md)) — and the
write replaces that set wholesale: a group left out is one the subject
leaves. An unknown group id, or one from another tenant, answers `400`
naming it.

**Joining a group is granting its roles**, and its ancestors' too, since
role resolution walks up the tree. So the write carries the same
capability ceiling `PUT /subjects/:id/roles` does: every role mapped to a
requested group or any of its ancestors, expanded through
`role_composites`, is compared with the caller's own capabilities, and a
set reaching past them is refused with `403`, leaves the membership
unchanged, and writes a `refused` row to the audit trail. The ceiling is
measured over the whole resulting set, as it is for roles — a caller
cannot resubmit a membership it could not itself have granted. And the
target ceiling ([`POST /subjects/:id/password`](./post-subjectsidpassword.md#the-target-ceiling))
comes first: a subject holding a capability the caller does not cannot
have any membership changed by that caller, removals included.

**`If-Match` is mandatory here, not optional**, for the reason it is on
`PUT /subjects/:id/roles`: absent, `428`; stale, `412`. The tag is over
the list exactly as the `GET` answers it, so reparenting a member group,
which rewrites its `path`, changes the tag even though the membership did
not; an empty membership answers the same `"eef46741…"` every empty list
here does.

Captured against the twelfth stack, in a tenant `groups-demo` created
through `POST /admin/tenants` for it. There, `platform-admins` is mapped to
`tenant-admin` through `PUT /groups/:id/roles`, `oncall` is its child with
no role of its own, `support` has none either, and `mei2` is a subject
created through `POST /subjects`. `$HELPDESK_TOKEN` belongs to `helpdesk`,
a user of that tenant created through `POST /subjects`, granted
`manage-users` alone through `PUT /subjects/:id/roles`, and signed in with
the one-time password `POST /subjects/:id/password` issued it;
`$ADMIN_TOKEN` is `ada`'s. The refusal
below turns on two facts, shown first — what `helpdesk` holds, and that
`oncall` carries nothing itself while its parent carries `tenant-admin`:

```bash
curl -sS -H "Authorization: Bearer $HELPDESK_TOKEN" \
  http://localhost:3082/admin/tenants/groups-demo/whoami

curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/groups-demo/groups/01a109b9-c2d9-7265-9cfe-1cc931aa4a87/roles

curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/groups-demo/groups/01a109b9-c2c0-7af8-baf6-399f4128272f/roles
```

```
{"subjectId":"01a109b9-c365-7216-9064-207c3931f9e0","issuerTenantId":"01a109b9-c288-7ef5-a623-21ab2f266513","capabilities":["manage-users","view-users"],"crossTenant":false}
{"items":[]}
{"items":[{"id":"01a109b9-c296-7612-84cf-fd8e6a727672","name":"tenant-admin","client_id":"01a109b9-c28f-78c9-bac7-b8be0801cfd6","client_key":"odudu-admin"}]}
```

The read, then a write with no `If-Match`, then `helpdesk` putting `mei2`
in `oncall`:

```bash
curl -sS -D - -H "Authorization: Bearer $HELPDESK_TOKEN" \
  http://localhost:3082/admin/tenants/groups-demo/subjects/01a109b9-c34e-7692-b5a4-67af33cf85e0/groups

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $HELPDESK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group_ids": ["01a109b9-c2f2-795b-9df3-36c34e89980e"]}' \
  http://localhost:3082/admin/tenants/groups-demo/subjects/01a109b9-c34e-7692-b5a4-67af33cf85e0/groups

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $HELPDESK_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"' \
  -d '{"group_ids": ["01a109b9-c2d9-7265-9cfe-1cc931aa4a87"]}' \
  http://localhost:3082/admin/tenants/groups-demo/subjects/01a109b9-c34e-7692-b5a4-67af33cf85e0/groups
```

```
HTTP/1.1 200 OK
x-request-id: 01a109b9-f21c-7f4a-b3f7-d25034ae0c60
cache-control: no-store
etag: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"
content-type: application/json; charset=utf-8
content-length: 12
Date: Mon, 05 Oct 2026 01:42:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}

HTTP/1.1 428 Precondition Required
x-request-id: 01a109b9-f22d-71b1-b8e2-f82b7f95e7e8
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 181
Date: Mon, 05 Oct 2026 01:42:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Precondition Required","status":428,"detail":"If-Match is required to replace a subject’s groups","instance":"01a109b9-f22d-71b1-b8e2-f82b7f95e7e8"}

HTTP/1.1 403 Forbidden
x-request-id: 01a109b9-f243-73fa-8f46-668be780b58a
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 228
Date: Mon, 05 Oct 2026 01:42:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Forbidden","status":403,"detail":"the caller does not hold: tenant-admin, manage-clients, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a109b9-f243-73fa-8f46-668be780b58a"}
```

`oncall` names no role, and is refused for everything `tenant-admin`
composites that `helpdesk` does not hold — reached through its parent.
The membership is still empty, under the same tag, so the same `If-Match`
then puts `mei2` in `support`, and replaying it once that has landed is
stale:

```bash
curl -sS -D - -H "Authorization: Bearer $HELPDESK_TOKEN" \
  http://localhost:3082/admin/tenants/groups-demo/subjects/01a109b9-c34e-7692-b5a4-67af33cf85e0/groups

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $HELPDESK_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"' \
  -d '{"group_ids": ["01a109b9-c2f2-795b-9df3-36c34e89980e"]}' \
  http://localhost:3082/admin/tenants/groups-demo/subjects/01a109b9-c34e-7692-b5a4-67af33cf85e0/groups

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $HELPDESK_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"' \
  -d '{"group_ids": []}' \
  http://localhost:3082/admin/tenants/groups-demo/subjects/01a109b9-c34e-7692-b5a4-67af33cf85e0/groups
```

```
HTTP/1.1 200 OK
x-request-id: 01a109b9-f25d-7357-a2c8-4c86697f32da
cache-control: no-store
etag: "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1"
content-type: application/json; charset=utf-8
content-length: 12
Date: Mon, 05 Oct 2026 01:42:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}

HTTP/1.1 200 OK
x-request-id: 01a109b9-f26f-7e40-9063-700663679c1b
cache-control: no-store
etag: "66a62a8dcf68d9df0b7e058b8cd86c42a83d9452d2fabf3f17091b29552fecf4"
content-type: application/json; charset=utf-8
content-length: 201
Date: Mon, 05 Oct 2026 01:42:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a109b9-c2f2-795b-9df3-36c34e89980e","name":"support","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/support","created_at":"2026-10-05T01:42:11.441Z"}]}

HTTP/1.1 412 Precondition Failed
x-request-id: 01a109b9-f288-78e9-ade7-7dfb8ef68ccd
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 153
Date: Mon, 05 Oct 2026 01:42:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a109b9-f288-78e9-ade7-7dfb8ef68ccd"}
```

Both writes that reached the ceiling are in the trail, scoped here to
`mei2` — the refusal naming what was denied, the replacement the ids
before and after:

On the same stack and tenant:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/groups-demo/audit?action=subject.groups_set&resource_type=subject&resource_id=01a109b9-c34e-7692-b5a4-67af33cf85e0'; echo
```

```
{"items":[{"id":"01a109b9-f27e-7d11-a166-1263b8d4466f","occurred_at":"2026-10-05T01:42:23.608Z","event_type":"admin_mutation","action":"subject.groups_set","outcome":"allowed","actor_tenant_id":"01a109b9-c288-7ef5-a623-21ab2f266513","actor_subject_id":"01a109b9-c365-7216-9064-207c3931f9e0","actor_client_id":"01a109b9-c28f-78c9-bac7-b8be0801cfd6","actor_name":"helpdesk","actor_origin":"tenant","resource_type":"subject","resource_id":"01a109b9-c34e-7692-b5a4-67af33cf85e0","request_id":"01a109b9-f26f-7e40-9063-700663679c1b","ip":"172.22.0.1","detail":{"group_ids":{"after":["01a109b9-c2f2-795b-9df3-36c34e89980e"],"before":[]}}},{"id":"01a109b9-f252-7573-967d-079323ae2a71","occurred_at":"2026-10-05T01:42:23.565Z","event_type":"admin_mutation","action":"subject.groups_set","outcome":"refused","actor_tenant_id":"01a109b9-c288-7ef5-a623-21ab2f266513","actor_subject_id":"01a109b9-c365-7216-9064-207c3931f9e0","actor_client_id":"01a109b9-c28f-78c9-bac7-b8be0801cfd6","actor_name":"helpdesk","actor_origin":"tenant","resource_type":"subject","resource_id":"01a109b9-c34e-7692-b5a4-67af33cf85e0","request_id":"01a109b9-f243-73fa-8f46-668be780b58a","ip":"172.22.0.1","detail":{"denied":["tenant-admin","manage-clients","manage-tenant","manage-keys","manage-sessions","view-audit"]}}]}
```
