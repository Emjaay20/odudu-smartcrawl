---
title: 'PUT /roles/:id/default'
description: 'Requires manage-tenant. The body is {"default": true} or {"default": false}, and the answer is the role with its ETag.'
---

# `PUT /roles/:id/default`

Requires `manage-tenant`. The body is `{"default": true}` or `{"default":
false}`, and the answer is the role with its `ETag`. `If-Match` is optional:
sent, it is compared with the role as it stands under the write's own lock, and
a stale one is refused with `412`. A role marked default is granted to **every
subject created afterwards** — through `POST /subjects`, self-registration and
`odudu seed` alike, which all call `grantNewSubjectDefaults` — and to none that
already exist, nor to a subject an import moves in with the roles its document
lists; unmarking it takes it from nobody who already holds it. Each change is
audited as `role.default_set`, with the flag's before and after in `detail`.

**A default role may reach no admin capability at all.** `true` is refused
with `403`, and a `refused` row written to the trail naming what it would
reach, when the role — expanded through `role_composites`, as the ceiling
on `POST /roles/:id/composites` expands a child — reaches any role of the
tenant's built-in admin client. That holds **whoever the caller is**: the
capability ceiling elsewhere admits what the caller holds, but a default
role is handed to strangers when registration is open, and no caller can
hold authority on their behalf. The same rule closes the other two doors
into that state: `POST /roles/:id/composites` refuses to nest a capability
under a role a default role reaches, and `POST /roles` refuses
`default_for_new_subjects: true` on a role of the built-in admin client,
each with a `refused` row too — the create's with no `resource_id`, since
no role came of it.
`false` is never refused.

In `composites-demo`, with roles `member` and `helpdesk-lead`, the second
nesting `manage-users`, created there for it. `member` marked default, then a
subject `rosa2` created and its roles read:

```bash
curl -sS -D - -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default": true}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5936-7527-bfc2-3cf4b330308c/default
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "rosa2"}' \
  http://localhost:3082/admin/tenants/composites-demo/subjects
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/composites-demo/subjects/01a10bd5-5aee-79fd-b43f-ff27c9c9ad54/roles
```

```
HTTP/1.1 200 OK
x-request-id: 01a10bd5-5ac6-7cc9-a1dd-46e31828a947
cache-control: no-store
etag: "7307e57f6bc03684f7a54461133050391dee92ead772649fe511876eb395eebf"
content-type: application/json; charset=utf-8
content-length: 204
Date: Mon, 05 Oct 2026 11:31:34 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a10bd5-5936-7527-bfc2-3cf4b330308c","name":"member","description":null,"client_id":null,"client_key":null,"default_for_new_subjects":true,"created_at":"2026-10-05T11:31:33.813Z","admin_reach":[]}
{"id":"01a10bd5-5aee-79fd-b43f-ff27c9c9ad54","type":"user","username":"rosa2","email":null,"enabled":true,"created_at":"2026-10-05T11:31:34.254Z"}
{"items":[{"id":"01a10bd5-5936-7527-bfc2-3cf4b330308c","name":"member","client_id":null,"client_key":null}]}
```

Unmarked, then a second subject `sven2`, who does not get it:

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default": false}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5936-7527-bfc2-3cf4b330308c/default
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "sven2"}' \
  http://localhost:3082/admin/tenants/composites-demo/subjects
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/composites-demo/subjects/01a10bd5-5b41-7890-9d02-bd6a9780bf21/roles
```

```
{"id":"01a10bd5-5936-7527-bfc2-3cf4b330308c","name":"member","description":null,"client_id":null,"client_key":null,"default_for_new_subjects":false,"created_at":"2026-10-05T11:31:33.813Z","admin_reach":[]}
{"id":"01a10bd5-5b41-7890-9d02-bd6a9780bf21","type":"user","username":"sven2","email":null,"enabled":true,"created_at":"2026-10-05T11:31:34.337Z"}
{"items":[]}
```

The refusal. `helpdesk-lead` is a tenant role that nests `manage-users`,
which in turn composites `view-users`; marking it default as `ada`, who
holds both and more, then reading it back:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5958-77b1-b858-d9bda6ecb6d0/composites
curl -sS -D - -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default": true}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5958-77b1-b858-d9bda6ecb6d0/default
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5958-77b1-b858-d9bda6ecb6d0
```

```
{"items":[{"id":"01a10bd5-5841-7874-aa25-572fc2a878e5","name":"manage-users","description":null,"client_id":"01a10bd5-5836-749c-aa8a-4b597ca19dde","client_key":"odudu-admin","default_for_new_subjects":false,"created_at":"2026-10-05T11:31:33.533Z","admin_reach":["view-users","manage-users"]}]}
HTTP/1.1 403 Forbidden
x-request-id: 01a10bd5-5b85-74dd-ac79-5d075d174832
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 233
Date: Mon, 05 Oct 2026 11:31:34 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Forbidden","status":403,"detail":"a role handed to every new subject may reach no admin capability, and this one would reach: manage-users, view-users","instance":"01a10bd5-5b85-74dd-ac79-5d075d174832"}
{"id":"01a10bd5-5958-77b1-b858-d9bda6ecb6d0","name":"helpdesk-lead","description":null,"client_id":null,"client_key":null,"default_for_new_subjects":false,"created_at":"2026-10-05T11:31:33.847Z","admin_reach":["view-users","manage-users"]}
```

`PATCH` still refuses the field, and says where it is set:

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_for_new_subjects": true}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5936-7527-bfc2-3cf4b330308c
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"default_for_new_subjects: default_for_new_subjects changes who a role is silently handed to at signup; set it with PUT /admin/tenants/{tenant}/roles/{id}/default, not a general amendment","errors":[{"path":"default_for_new_subjects","message":"default_for_new_subjects changes who a role is silently handed to at signup; set it with PUT /admin/tenants/{tenant}/roles/{id}/default, not a general amendment"}],"instance":"01a10bd5-5bb6-70bb-bb59-bd2350e8942f"}
```

The trail, newest first — the refusal naming what `helpdesk-lead` would
have handed out, and `member`'s two changes. Two roles are named here, so
`resource_id` alone cannot select both; bounded instead with `to=` at a
point before the composite-door demonstration below repeats
`role.default_set` against the same `member` role:

The same again, now that each row answers `actor_name` and `actor_origin`; the
ids are a fresh run's, not those above:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/composites-demo/audit?action=role.default_set&to=2026-10-27T01:35:42.000Z&limit=3'; echo
```

```
{"items":[{"id":"01a0ee92-a71f-7771-9b1a-03a150ed714d","occurred_at":"2026-09-29T19:09:43.575Z","event_type":"admin_mutation","action":"role.default_set","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"role","resource_id":"01a0ee92-a288-7ed8-9c42-53a785bcb715","request_id":"01a0ee92-a6de-79b1-953a-0c1ea870ddf4","ip":"172.22.0.1","detail":{"denied":["manage-users","view-users"]}},{"id":"01a0ee92-a6d6-75f3-a442-ac6daeb27c94","occurred_at":"2026-09-29T19:09:43.505Z","event_type":"admin_mutation","action":"role.default_set","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"role","resource_id":"01a0ee92-a253-705a-8b4e-3ea3cb68bbf7","request_id":"01a0ee92-a6b9-7135-9a56-79d0f994e9e5","ip":"172.22.0.1","detail":{"default_for_new_subjects":{"after":false,"before":true}}},{"id":"01a0ee92-a69c-73a6-b9c0-2a21029de42c","occurred_at":"2026-09-29T19:09:43.440Z","event_type":"admin_mutation","action":"role.default_set","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"role","resource_id":"01a0ee92-a253-705a-8b4e-3ea3cb68bbf7","request_id":"01a0ee92-a67c-7ec0-8d69-42d693e4b738","ip":"172.22.0.1","detail":{"default_for_new_subjects":{"after":true,"before":false}}}]}
```

After that trail was read, the composite door: `member` marked default
again, `view-users` nested under it refused, and `member` unmarked:

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default": true}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5936-7527-bfc2-3cf4b330308c/default
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_role_id": "01a10bd5-5840-7456-ae39-b63101320c03"}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5936-7527-bfc2-3cf4b330308c/composites
curl -sS -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default": false}' \
  http://localhost:3082/admin/tenants/composites-demo/roles/01a10bd5-5936-7527-bfc2-3cf4b330308c/default
```

```
{"id":"01a10bd5-5936-7527-bfc2-3cf4b330308c","name":"member","description":null,"client_id":null,"client_key":null,"default_for_new_subjects":true,"created_at":"2026-10-05T11:31:33.813Z","admin_reach":[]}
HTTP/1.1 403 Forbidden
x-request-id: 01a10bd5-5bf0-7460-9683-f92098742e2d
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 219
Date: Mon, 05 Oct 2026 11:31:34 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Forbidden","status":403,"detail":"a role handed to every new subject may reach no admin capability, and this one would reach: view-users","instance":"01a10bd5-5bf0-7460-9683-f92098742e2d"}
{"id":"01a10bd5-5936-7527-bfc2-3cf4b330308c","name":"member","description":null,"client_id":null,"client_key":null,"default_for_new_subjects":false,"created_at":"2026-10-05T11:31:33.813Z","admin_reach":[]}
```

## How many are handed out

At most 200 roles are default at once, and at most 200 groups, because a new
subject is given every one of them in one transaction. On `perf-demo`, after
200 roles `dd-1` to `dd-200` were each set default, the 201st:

```bash
curl -sS -D - -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' -d '{"default":true}' \
  "$P/roles/$DD_201/default"
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a10f7f-ccde-786c-ae84-8c0cda061c50
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 165
Date: Tue, 27 Oct 2026 01:36:16 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Conflict","status":409,"detail":"at most 200 roles are handed to every new subject","instance":"01a10f7f-ccde-786c-ae84-8c0cda061c50"}
```

`PUT /groups/:id/default` answers the same `409` for groups. On `perf-demo`, after
200 groups `gd-1` to `gd-200` were each set default, the 201st:

```bash
curl -sS -D - -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' -d '{"default":true}' \
  "$P/groups/$GD_201/default"
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a17b29-7b0a-7d29-9938-ffd14b747ea5
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 166
Date: Tue, 27 Oct 2026 02:21:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Conflict","status":409,"detail":"at most 200 groups are joined by every new subject","instance":"01a17b29-7b0a-7d29-9938-ffd14b747ea5"}
```
