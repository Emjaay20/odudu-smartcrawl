---
title: 'PUT /scopes/:id/clients/:clientId'
description: 'Requires manage-tenant. Assigns the scope to the client as default or optional, narrowing or widening any existing assignment rather than colliding…'
---

# `PUT /scopes/:id/clients/:clientId`

Requires `manage-tenant`. Assigns the scope to the client as `default` or
`optional`, narrowing or widening any existing assignment rather than colliding
with it (`clientScopeRepository.assignOrUpdate`) — the same behaviour the seed
CLI's own assign-scope command depends on. Answers with the client's scope
assignments — `client_id` and `scopes` — so the result is visible immediately
without a second `GET /clients/:id`, and **nothing else**: this route asks for
`manage-tenant`, where reading a client asks for the stricter `manage-clients`,
so answering with the client's own representation would hand the weaker holder
`redirect_uris`, `jwks`, `audiences` and every grant setting through a side
door. An unknown scope or client id answers `404`, and a client whose service
account holds an admin capability the caller does not is refused with `403`
([the service account's
ceiling](./post-clientsidsecret.md#the-service-accounts-ceiling)).

The ids below are a later run's rather than the ones the sections above show.

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assignment": "default"}' \
  http://localhost:3000/admin/tenants/demo/scopes/01a0d767-b5e6-74f8-89a0-f3afa7e2f6c0/clients/01a0d767-a054-7a00-b96d-eea9492c4e4d
```

The assignments come back, with `billing` appended to the eight scopes
`demo-app` already carried — the same `scopes` shape `GET /clients/:id`
carries, and nothing besides:

```
{"client_id":"01a0d767-a054-7a00-b96d-eea9492c4e4d","scopes":[{"id":"01a0d764-e837-75cb-b5eb-bf56c1193e85","name":"openid","assignment":"default"},{"id":"01a0d764-e83b-7c1c-84cc-624bbbe5947d","name":"profile","assignment":"default"},{"id":"01a0d764-e83c-76ee-976a-14b79a5f8c8b","name":"email","assignment":"default"},{"id":"01a0d764-e83d-74c0-a341-bfc8dc17ece7","name":"address","assignment":"default"},{"id":"01a0d764-e83d-74c0-a341-bfc97cd8d0bd","name":"phone","assignment":"default"},{"id":"01a0d764-e83e-778c-8fe8-0b8122e3d178","name":"roles","assignment":"default"},{"id":"01a0d764-e83f-7e65-bb51-c62daaadd27d","name":"groups","assignment":"default"},{"id":"01a0d764-e83f-7e65-bb51-c62e4d176cc8","name":"offline_access","assignment":"optional"},{"id":"01a0d767-b5e6-74f8-89a0-f3afa7e2f6c0","name":"billing","assignment":"default"}]}
```

## The most scopes a client carries

A client is read and listed with its scopes, so it carries at most 200
(`CLIENT_SCOPE_LIMIT`, `@odudu/contracts`): the same bound as every other set
the admin API replaces, though the tenant may define up to 1,000. A scope a
client does not yet carry is refused with `409` once it holds 200; changing how
one it already carries is assigned is not, and removing one makes room. A client
that held more before the bound existed keeps what it has and takes no new scope
until it is under. The count is taken under a lock on the client's row, so two
assignments at 199 let one in. The same bound refuses, at the door they come
through: a tenant import that gives a client more, a scope marked for every new
client past 200 (below), and `odudu seed assign-scope`.

The client's 8 default scopes plus 192 `billing-N` written by `psql`, so that it
carries exactly 200, and `reports:read` unmarked. The precondition, shown:

```bash
psql -tA -c "select count(*) from client_scope_assignments where client_id = '$CID'"
psql -tA -c "select default_client_assignment is null from client_scopes where id = '$SID'"
```

```
200
t
```

Assigning a scope it does not carry:

```bash
curl -sS -D - -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"assignment":"default"}' "$P/scopes/$SID/clients/$CID"
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a11266-79f9-7975-86e7-096bbe095f7a
content-type: application/problem+json; charset=utf-8
content-length: 151

{"type":"about:blank","title":"Conflict","status":409,"detail":"a client carries at most 200 scopes","instance":"01a11266-79f9-7975-86e7-096bbe095f7a"}
```

Changing one it carries (`$BID`, `billing-1`) answers `200`, removing it answers
`204`, and `reports:read` then goes in. The bodies, each the client's 200 scopes,
are left out with `-o /dev/null`; the headers are the answers':

```bash
curl -sS -D - -o /dev/null -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"assignment":"default"}' "$P/scopes/$BID/clients/$CID"
curl -sS -D - -o /dev/null -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$P/scopes/$BID/clients/$CID"
curl -sS -D - -o /dev/null -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"assignment":"optional"}' "$P/scopes/$SID/clients/$CID"
```

```
HTTP/1.1 200 OK
x-request-id: 01a11266-7a17-7584-8e68-b4b9c45f32b3
etag: "503949510281d7d735db6e6e49b2c747bb77b4ab31a603787f51128c2d66278b"
content-type: application/json; charset=utf-8
content-length: 18114

HTTP/1.1 204 No Content
x-request-id: 01a11266-7a3b-777b-8a1d-d24bebbc2997
etag: "cf9515f4a03e3ad1376ded152fb7d06a21547fbc3fa73cb5fc11a2c0e18e4cdd"

HTTP/1.1 200 OK
x-request-id: 01a11266-7a5d-7430-b8cf-9ae20b95ab3c
etag: "70c5724820911f7214efcc042bf5eaabba371e3b0b22b95156a1bd5dab33c757"
content-type: application/json; charset=utf-8
content-length: 18118
```

The client carries 200 again, so `odudu seed assign-scope` of `late` is refused,
the command exiting `1` with the error and the stack Node prints for every seed
refusal (its Web Crypto warnings and the stack's frames are left out):

```bash
docker compose -p odudu-tx exec -T odudu node dist/main.js seed assign-scope \
  --tenant scope-limit-docs --client-id limit-app --scope late --assignment optional
```

```
OduduError: a client carries at most 200 scopes
  code: 'seed_invalid_options'
```

A tenant import that gives a client more is refused with `400`, naming the
client's place in the document and its count. The document is the tenant's own
export with one more scope, `one-more`, listing `limit-app`, which makes 201:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/export" > export.json
# add to export.json's scopes an entry named one-more whose clients lists limit-app
curl -sS -D - -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  --data @import.json "$A/../tenant-imports"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a11266-7d24-7c2d-8672-de80c4d9f7bc
content-type: application/problem+json; charset=utf-8
content-length: 270

{"type":"about:blank","title":"Bad Request","status":400,"detail":"the import was refused for 1 problem(s), listed under errors","errors":[{"path":"document.clients[0].scopes","message":"holds 201 scopes, at most 200"}],"instance":"01a11266-7d24-7c2d-8672-de80c4d9f7bc"}
```

The OpenAPI document declares that same shape as the `200`'s body —
`assignScopeToClientResponseSchema`, not the client's own. The published
document's entry for this route, extracted with the filter shown:

```bash
curl -sS http://localhost:3080/admin/openapi.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);console.log(JSON.stringify(d.paths["/admin/tenants/{tenant}/scopes/{id}/clients/{clientId}"].put.responses["200"]))})'
```

```
{"description":"OK","content":{"application/json":{"schema":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"client_id":{"type":"string"},"scopes":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"assignment":{"type":"string","enum":["default","optional"]}},"required":["id","name","assignment"],"additionalProperties":false}}},"required":["client_id","scopes"],"additionalProperties":false}}}}
```

## The client's new `ETag`

The client's own representation carries its `scopes`, so an assignment changes
the `ETag` `GET /clients/:id` answers. The `PUT` answers that new `ETag`, and so
does `DELETE /scopes/:id/clients/:clientId` beside its `204`, so a caller
editing the client can save its next change without reading it again — the
`ETag` is a digest, and hands the `manage-tenant` holder none of what it covers.
In `etags-demo`, on a public client `etags-app`
(`01a0e9ec-d64a-7d5d-a0ac-a01efd56b6f3`) and a scope `billing`
(`01a0e9ec-d68e-7463-8023-bd155594d026`), both created there for it:

```bash
curl -sS -D - -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"assignment":"optional"}' \
  http://localhost:3080/admin/tenants/etags-demo/scopes/01a0e9ec-d68e-7463-8023-bd155594d026/clients/01a0e9ec-d64a-7d5d-a0ac-a01efd56b6f3
curl -sS -D - -o /dev/null -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3080/admin/tenants/etags-demo/clients/01a0e9ec-d64a-7d5d-a0ac-a01efd56b6f3
```

```
HTTP/1.1 200 OK
etag: "4239c83cdd1615fda6c595070f888200acba67bd27421287344614b7827f4165"
{"client_id":"01a0e9ec-d64a-7d5d-a0ac-a01efd56b6f3","scopes":[{"id":"01a0e9ec-6338-7743-a6cf-bf196533da83","name":"openid","assignment":"default"},{"id":"01a0e9ec-6338-7743-a6cf-bf1a6fe8811d","name":"profile","assignment":"default"},{"id":"01a0e9ec-6339-782e-9a8d-42f903942e10","name":"email","assignment":"default"},{"id":"01a0e9ec-633a-7996-82df-731802038298","name":"address","assignment":"default"},{"id":"01a0e9ec-633a-7996-82df-7319409725e4","name":"phone","assignment":"default"},{"id":"01a0e9ec-633b-7f20-8264-586c5a087d01","name":"roles","assignment":"default"},{"id":"01a0e9ec-633b-7f20-8264-586da97b298d","name":"groups","assignment":"default"},{"id":"01a0e9ec-633c-752d-a317-52e94971abf9","name":"offline_access","assignment":"optional"},{"id":"01a0e9ec-d68e-7463-8023-bd155594d026","name":"billing","assignment":"optional"}]}
HTTP/1.1 200 OK
etag: "4239c83cdd1615fda6c595070f888200acba67bd27421287344614b7827f4165"
```
