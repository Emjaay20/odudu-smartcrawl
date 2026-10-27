---
title: 'Groups: list, create, read, update, delete'
description: 'All five require manage-tenant; the list, GET /groups, is also readable with view-users (below).'
---

# Groups: list, create, read, update, delete

This page covers `GET /groups`, `POST /groups`, `GET /groups/:id`, `PATCH /groups/:id` and `DELETE /groups/:id`.

All five require `manage-tenant`; the list, `GET /groups`, is also readable with
`view-users` (below). `path` is derived, never accepted: a root group's is
`/name`, a child's is its parent's with `/name` appended, and `groupRepository`
is the only writer of it. A group carries a `description`, as a role does: at
most 1000 characters on `POST` and `PATCH`, `null` to clear, exported and
imported with the group. `PATCH` amends `description` and `parent_id` —
reparenting, which recomputes `path` for the group and every descendant — and
every other field is refused with a reason. A `parent_id` naming no group
answers `400`, the same refusal `POST /groups` gives for the same input.
Reparenting into the group's own subtree answers `409` (`group_reparent_cycle`),
and so does a parent already holding a group of that name, the same way a role
composite's cycle does. Both doors that choose a parent carry the same
capability ceiling: naming a parent whose own roles — or any ancestor's — reach
a capability the caller does not hold answers `403`, on `POST /groups` as on
`PATCH`, since every subject later placed in the group would inherit it.
`DELETE` **deletes the whole subtree**, not one group: `groups_parent_fk`
cascades on the parent, so every descendant is deleted with it, and each of
those takes its own `group_roles` mappings and `subject_groups` memberships
along. A child does not survive as a new root, and there is no confirmation step
— a `DELETE` of a group near the top of a tree removes everything under it. Both
a reparent and a `DELETE` are also held to what they take away ([a removal is
judged by what it
removes](./get-groupsidroles-and-put-groupsidroles.md#a-removal-is-judged-by-what-it-removes)).

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "engineering", "description": "Everyone who builds the product"}' \
  http://localhost:3082/admin/tenants/reparent-demo/groups
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "platform"}' \
  http://localhost:3082/admin/tenants/reparent-demo/groups
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parent_id": "01a10bd5-db89-7667-aef3-c72b84512143"}' \
  http://localhost:3082/admin/tenants/reparent-demo/groups/01a10bd5-dba5-774c-b5c2-1e04647f251c
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parent_id": "01a10bd5-dba5-774c-b5c2-1e04647f251c"}' \
  http://localhost:3082/admin/tenants/reparent-demo/groups/01a10bd5-db89-7667-aef3-c72b84512143
```

In a tenant `reparent-demo` made for it: two roots, `engineering`, created with
a `description`, and `platform`, then `platform` reparented under `engineering`
— `path` is recomputed by the write, never sent — then the reverse, refused.
Each write answers the group's record, with the derived fields described
[below](#what-a-group-hands-out-admin_reach-subtree_admin_reach-and-holds_default_group):

```
{"id":"01a10bd5-db89-7667-aef3-c72b84512143","name":"engineering","description":"Everyone who builds the product","parent_id":null,"default_for_new_subjects":false,"path":"/engineering","created_at":"2026-10-05T11:32:07.176Z","admin_reach":[],"subtree_admin_reach":[],"holds_default_group":false}
{"id":"01a10bd5-dba5-774c-b5c2-1e04647f251c","name":"platform","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/platform","created_at":"2026-10-05T11:32:07.205Z","admin_reach":[],"subtree_admin_reach":[],"holds_default_group":false}
{"id":"01a10bd5-dba5-774c-b5c2-1e04647f251c","name":"platform","description":null,"parent_id":"01a10bd5-db89-7667-aef3-c72b84512143","default_for_new_subjects":false,"path":"/engineering/platform","created_at":"2026-10-05T11:32:07.205Z","admin_reach":[],"subtree_admin_reach":[],"holds_default_group":false}
{"type":"about:blank","title":"Conflict","status":409,"detail":"would create a group reparent cycle","instance":"01a10bd5-dbe3-782c-9496-99259a4c56c7"}
```

**Search** is `?name=`, the same prefix match `GET /roles` above describes, over
`groups.name_search`; it matches a group's own name, not its `path`. Whose
`demo` was made for it and held no groups until `engineering`, `Engineering-Ops`
and `finance` were created there as roots:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "engineering"}' \
  http://localhost:3082/admin/tenants/demo/groups
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering-Ops"}' \
  http://localhost:3082/admin/tenants/demo/groups
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "finance"}' \
  http://localhost:3082/admin/tenants/demo/groups
```

```
{"id":"01a10bd5-dd65-7a80-911a-cc2c507e344a","name":"engineering","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/engineering","created_at":"2026-10-05T11:32:07.652Z","admin_reach":[],"subtree_admin_reach":[],"holds_default_group":false}
{"id":"01a10bd5-dd85-7eb2-92de-c42a6d943235","name":"Engineering-Ops","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/Engineering-Ops","created_at":"2026-10-05T11:32:07.684Z","admin_reach":[],"subtree_admin_reach":[],"holds_default_group":false}
{"id":"01a10bd5-dda0-7ad1-8532-1c46e6455c80","name":"finance","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/finance","created_at":"2026-10-05T11:32:07.712Z","admin_reach":[],"subtree_admin_reach":[],"holds_default_group":false}
```

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/groups?name=ENG"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/groups?name=eng&limit=1"
```

```
{"items":[{"id":"01a10bd5-dd65-7a80-911a-cc2c507e344a","name":"engineering","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/engineering","created_at":"2026-10-05T11:32:07.652Z","admin_reach":[]},{"id":"01a10bd5-dd85-7eb2-92de-c42a6d943235","name":"Engineering-Ops","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/Engineering-Ops","created_at":"2026-10-05T11:32:07.684Z","admin_reach":[]}]}
{"items":[{"id":"01a10bd5-dd65-7a80-911a-cc2c507e344a","name":"engineering","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/engineering","created_at":"2026-10-05T11:32:07.652Z","admin_reach":[]}],"next":"eyJhZnRlciI6IjAxYTEwYmQ1LWRkNjUtN2E4MC05MTFhLWNjMmM1MDdlMzQ0YSIsInNvcnQiOiJlbmdpbmVlcmluZyIsImNvbGxlY3Rpb24iOiJncm91cHMiLCJ0ZW5hbnRJZCI6IjAxYTEwYmQ1LWRkMjgtNzExMi1iZTZhLWFmZGNmZTI2ZDBiOSIsImZpbHRlcnMiOiJzTVFsYy1tTnM3SUxXZHhsYk9YOUJKRlA0dzlSb05MMXlpSVJ0bmxrQnZNIn0.G4t9F9W-MuaGWLnZ4KuJyJdzAWhVRLRMEiE_nfqDnUU"}
```

Following that cursor, then replaying it with `?name=` dropped:

```bash
CURSOR='eyJhZnRlciI6IjAxYTEwYmQ1LWRkNjUtN2E4MC05MTFhLWNjMmM1MDdlMzQ0YSIsInNvcnQiOiJlbmdpbmVlcmluZyIsImNvbGxlY3Rpb24iOiJncm91cHMiLCJ0ZW5hbnRJZCI6IjAxYTEwYmQ1LWRkMjgtNzExMi1iZTZhLWFmZGNmZTI2ZDBiOSIsImZpbHRlcnMiOiJzTVFsYy1tTnM3SUxXZHhsYk9YOUJKRlA0dzlSb05MMXlpSVJ0bmxrQnZNIn0.G4t9F9W-MuaGWLnZ4KuJyJdzAWhVRLRMEiE_nfqDnUU'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/groups?limit=1&name=eng&cursor=$CURSOR"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/groups?limit=1&cursor=$CURSOR"
```

```
{"items":[{"id":"01a10bd5-dd85-7eb2-92de-c42a6d943235","name":"Engineering-Ops","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/Engineering-Ops","created_at":"2026-10-05T11:32:07.684Z","admin_reach":[]}]}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"cursor is invalid or expired","errors":[{"path":"cursor","message":"is invalid or expired"}],"instance":"01a10bd5-de07-741a-aa7c-320313479de0"}
```

## The list a user manager picks from

`GET /groups` alone is also readable with `view-users`, and so with
`manage-users`, for the reason and within the limits the same subsection under
`GET /roles` gives, where it is shown.

## One level of the tree

`?parent=<id>` lists a group's children and `?parent=root` the groups with no
parent, so a tree is drawn a level at a time rather than from every page of
groups; `GET /groups/count` takes it too, and it `AND`s with `?name=`. A value
that is neither a UUID nor `root` is refused with `400`. In an `ops-demo` of its
own holding `/finance` and `/finance/payables` alone, made there with `POST
/groups`, `$P` its `http://localhost:3082/admin/tenants/ops-demo`:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups?parent=root"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups?parent=01a10bd5-e00d-7a85-b3b3-f80e06a9f438"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups/count?parent=01a10bd5-e00d-7a85-b3b3-f80e06a9f438"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups?parent=top"; echo
```

```
{"items":[{"id":"01a10bd5-e00d-7a85-b3b3-f80e06a9f438","name":"finance","description":null,"parent_id":null,"default_for_new_subjects":false,"path":"/finance","created_at":"2026-10-05T11:32:08.332Z","admin_reach":[]}]}
{"items":[{"id":"01a10bd5-e02b-7107-9e64-b6c0eb005c1a","name":"payables","description":null,"parent_id":"01a10bd5-e00d-7a85-b3b3-f80e06a9f438","default_for_new_subjects":false,"path":"/finance/payables","created_at":"2026-10-05T11:32:08.362Z","admin_reach":[]}]}
{"count":1,"capped":false}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/parent must match pattern \"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$\", querystring/parent must be equal to constant, querystring/parent must match a schema in anyOf","errors":[{"path":"parent","message":"must match pattern \"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$\""},{"path":"parent","message":"must be equal to constant"},{"path":"parent","message":"must match a schema in anyOf"}],"instance":"01a10bd5-e081-7442-a6c4-d5cc8676e0dd"}
```

## What a group hands out: `admin_reach`, `subtree_admin_reach` and `holds_default_group`

Every group answer carries `admin_reach`: what membership of the group hands
out — the roles it and every group above it map, expanded through
`role_composites` — by `capabilitiesOfGroupsAndAncestors`, read for a whole
page in one query. A group's own record, and each write that answers it, also
carries `subtree_admin_reach`: what deleting it takes from the subjects in it
and beneath it, by `capabilitiesOfSubtree`, which is what the delete is held
to. A record also carries `holds_default_group`: whether this group or one
beneath it is a default for new subjects, which is the condition that bars
moving it under a parent handing out an admin capability, and mapping it such
a role (`PUT /groups/:id/default` below). A subject's own groups
(`GET /subjects/:id/groups`) carry none of the three, and a group's roles
(`GET /groups/:id/roles`) carry each role's own `admin_reach`. All of them are
derived, outside the `ETag`, and refused by `PATCH` with a reason.

In `reach-demo`: `/ops` mapped to `audit-bundle` above, its child `/ops/oncall`,
and `/ops/oncall/pager` mapped to `odudu-admin:manage-keys`, each made there for
it with `POST /groups` and `PUT /groups/:id/roles`. `/ops/oncall` maps nothing
itself, hands out what `/ops` does, and would take `manage-keys` too:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" $P/groups/01a10bd6-2d5b-707e-9610-8bb4deb9a2d8; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups?parent=01a10bd6-2d3d-743c-bcd6-7b868d510375"; echo
```

```
{"id":"01a10bd6-2d5b-707e-9610-8bb4deb9a2d8","name":"oncall","description":null,"parent_id":"01a10bd6-2d3d-743c-bcd6-7b868d510375","default_for_new_subjects":false,"path":"/ops/oncall","created_at":"2026-10-05T11:32:28.121Z","admin_reach":["view-audit"],"subtree_admin_reach":["manage-keys","view-audit"],"holds_default_group":false}
{"items":[{"id":"01a10bd6-2d5b-707e-9610-8bb4deb9a2d8","name":"oncall","description":null,"parent_id":"01a10bd6-2d3d-743c-bcd6-7b868d510375","default_for_new_subjects":false,"path":"/ops/oncall","created_at":"2026-10-05T11:32:28.121Z","admin_reach":["view-audit"]}]}
```

## A reparent onto a name already taken

A move rewrites the group's `path`, so a parent already holding a group of the
same name refuses it with `409`, before anything is written — the same refusal
`POST /groups` gives for the same name. A sibling that takes the name between
that check and the rewrite is refused by the unique index on `path` at the
write, and answers the same `409`, with the move and any description change
taken back together. In the same tenant, with a `/finance/oncall` made there
beside `/ops/oncall`, both listed first, then the move, then the group read
back:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups?parent=01a10bd6-2e1f-7da2-b99d-8af7b7e7dc57" | jq -c '.items[] | {path}'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/groups?parent=01a10bd6-2d3d-743c-bcd6-7b868d510375" | jq -c '.items[] | {path}'
curl -sS -D - -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"parent_id":"01a10bd6-2e1f-7da2-b99d-8af7b7e7dc57"}' $P/groups/01a10bd6-2d5b-707e-9610-8bb4deb9a2d8
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" $P/groups/01a10bd6-2d5b-707e-9610-8bb4deb9a2d8 | jq -c '{path, parent_id}'
```

```
{"path":"/finance/oncall"}
{"path":"/ops/oncall"}
HTTP/1.1 409 Conflict
x-request-id: 01a17afe-5fab-7db6-b1e3-35954f19a1b5
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 161
Date: Tue, 27 Oct 2026 01:34:13 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Conflict","status":409,"detail":"a group named \"oncall\" already exists there","instance":"01a10bd6-2ee5-745c-bb66-a51d6aad8e30"}
{"path":"/ops/oncall","parent_id":"01a10bd6-2d3d-743c-bcd6-7b868d510375"}
```
