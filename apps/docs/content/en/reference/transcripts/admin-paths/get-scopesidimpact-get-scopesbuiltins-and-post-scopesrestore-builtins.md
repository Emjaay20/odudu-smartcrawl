---
title: 'Scope impact, built-in scopes and restore'
description: 'All three require manage-tenant. They support deleting a built-in scope: what it takes, which built-ins are missing, and how to restore them…'
---

# Scope impact, built-in scopes and restore

This page covers `GET /scopes/:id/impact`, `GET /scopes/builtins` and `POST /scopes/restore-builtins`.

All three require `manage-tenant`. They are what deleting a built-in scope needs
around it: what the delete would take, which built-ins a tenant is missing, and
the way to create a missing one again. A **built-in** scope is one every tenant
is given when it is created: `openid`, `profile`, `email`, `address`, `phone`,
`roles`, `groups` and `offline_access`. `DELETE /scopes/:id` deletes any of them
but `openid`, and only when its `confirm` query parameter names the scope again,
as `DELETE /admin/tenants/{tenant}` does for a tenant, so a script cannot take
one by accident. Built-in status is decided by the name alone, so a scope created under one of those names is built in too, and a restore will not create a name that exists. An ordinary scope needs no `confirm`, and one sent with it is
ignored.

Every block below ran on a stack built from this branch and driven only as far
as this page needs: `odudu seed admin`, `$ADMIN_TOKEN` got as in [Getting the
token](./getting-the-token.md), then the tenant `builtins-demo`, a public client
`portal`, and the role `auditor` mapped to the `roles` scope with `odudu seed`.
The stack published port `3192`.

## What a delete would take

`GET /scopes/:id/impact` says whether the scope is built in and how many clients
carry it and roles map it, the two things its deletion takes with it. Each count
stops at a ceiling and says `capped`, so the answer is two bounded index reads
however large the tenant is. `roles` is carried by `portal` and by the tenant's
own admin client, and `auditor` is mapped to it:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3841-7c44-8665-e0d89bc86380/impact; echo
```

```
{"builtin":true,"client_assignments":{"count":2,"capped":false},"role_mappings":{"count":1,"capped":false}}
```

## Deleting a built-in scope asks for its name

Without `confirm` the delete is refused with `422` and the type
`builtin-scope-confirmation`; `detail` names the scope, what would go with it and
what to send. Nothing is deleted, and the refusal is audited. A `confirm` that is
not the scope's own name is refused the same way:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3841-7c44-8665-e0d89bc86380
```

```
HTTP/1.1 422 Unprocessable Entity
x-request-id: 01a163f6-3df4-75db-b8a5-674c38bdece3
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 313
Date: Thu, 22 Oct 2026 14:14:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank#builtin-scope-confirmation","title":"Unprocessable Content","status":422,"detail":"roles is a built-in scope. Deleting it removes it from 2 clients and unmaps 1 role, and cannot be undone. Repeat the request with confirm=roles to delete it.","instance":"01a163f6-3df4-75db-b8a5-674c38bdece3"}
```

```bash
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3841-7c44-8665-e0d89bc86380?confirm=role"; echo
```

```
{"type":"about:blank#builtin-scope-confirmation","title":"Unprocessable Content","status":422,"detail":"roles is a built-in scope. Deleting it removes it from 2 clients and unmaps 1 role, and cannot be undone. Repeat the request with confirm=roles to delete it.","instance":"01a163f6-3e15-7488-8e9a-5ba79eb450ab"}
```

`openid` stays refused with `409` whatever `confirm` says, since taking it off
every client would lock every administrator of the tenant out:

```bash
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3833-718e-8f5e-7f326dd666c0?confirm=openid"; echo
```

```
{"type":"about:blank","title":"Conflict","status":409,"detail":"openid is deleted along with every client’s assignment of it, this tenant’s built-in admin client’s included, and could lock out every administrator of this tenant","instance":"01a163f6-3e34-7b93-9a52-b13d2b4b8785"}
```

Naming the scope deletes it, with the assignments and role mappings that
referred to it:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3841-7c44-8665-e0d89bc86380?confirm=roles"
```

```
HTTP/1.1 204 No Content
x-request-id: 01a163f6-3e4e-7736-95c7-de6acff5ad27
cache-control: no-store
Date: Thu, 22 Oct 2026 14:14:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72

```

## Which are missing, and getting them back

`GET /scopes/builtins` lists every built-in in the order a new tenant is given
them, with whether this tenant has it; narrowed with `jq` to the missing ones:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/builtins | jq -c ".items[] | select(.present | not)"
```

```
{"name":"roles","present":false}
```

`POST /scopes/restore-builtins` creates each missing built-in with the settings
a new tenant is given and answers the names it created. A scope that exists is
neither read nor changed, edited or not, so a second call creates none. It takes
no body:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/restore-builtins; echo
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/restore-builtins; echo
```

```
{"created":["roles"]}
{"created":[]}
```

The restored scope has its shipped settings, marked `default` for clients made
from now on, but not what the deletion took: no client carries it and no role is
mapped to it, so each is assigned and mapped again. It is refused with `409`,
creating nothing, when the missing scopes would pass the tenant's limit of 1,000
scopes or of 200 scopes marked for every new client.

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3e95-77a2-8c20-0621710b44f2; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3192/admin/tenants/builtins-demo/scopes/01a163f6-3e95-77a2-8c20-0621710b44f2/impact; echo
```

```
{"id":"01a163f6-3e95-77a2-8c20-0621710b44f2","name":"roles","description":null,"include_in_id_token":false,"include_in_access_token":true,"default_client_assignment":"default","consent_text":null,"display_order":0,"created_at":"2026-10-22T14:14:04.689Z"}
{"builtin":true,"client_assignments":{"count":0,"capped":false},"role_mappings":{"count":0,"capped":false}}
```

## The trail

A delete writes one `scope.delete` row, `allowed` or `refused`, whose detail
carries `builtin` and how many client assignments and role mappings it took or
would have taken. A restore that creates something writes one
`scope.restore_builtins` row naming what it created, and one that creates
nothing writes none. The two refusals and the delete of `roles` above, narrowed
with `jq` to the counts, and the restore:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3192/admin/tenants/builtins-demo/audit?resource_type=scope&action=scope.delete&resource_id=01a163f6-3841-7c44-8665-e0d89bc86380" | jq -c ".items[] | {outcome, builtin: .detail.builtin, clients: .detail.client_assignments, roles: .detail.role_mappings}"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3192/admin/tenants/builtins-demo/audit?action=scope.restore_builtins" | jq -c ".items[] | {action, outcome, detail}"
```

```
{"outcome":"allowed","builtin":true,"clients":2,"roles":1}
{"outcome":"refused","builtin":true,"clients":2,"roles":1}
{"outcome":"refused","builtin":true,"clients":2,"roles":1}
{"action":"scope.restore_builtins","outcome":"allowed","detail":{"created":["roles"]}}
```

## From the command line

`odudu seed restore-scopes --tenant <name>` does the same through the same
function, for an installation with no admin token to hand. It prints the names
it created and is just as harmless to repeat. Here `groups` was deleted first
with `?confirm=groups`; the command's own warnings on standard error are
discarded:

```bash
docker compose exec -T odudu node dist/main.js seed restore-scopes --tenant builtins-demo 2>/dev/null
docker compose exec -T odudu node dist/main.js seed restore-scopes --tenant builtins-demo 2>/dev/null
```

```
{"command":"restore-scopes","tenant":"builtins-demo","tenantId":"01a163f6-381e-7464-8b39-7093a24cdfc9","created":["groups"]}
{"command":"restore-scopes","tenant":"builtins-demo","tenantId":"01a163f6-381e-7464-8b39-7093a24cdfc9","created":[]}
```
