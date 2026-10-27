---
title: 'GET /scopes/:id/mappers and PUT /scopes/:id/mappers'
description: "Both require manage-tenant. GET returns available — every mapper name the process's ClaimMapperRegistry carries, the same registry ID token and…"
---

# `GET /scopes/:id/mappers` and `PUT /scopes/:id/mappers`

Both require `manage-tenant`. `GET` returns `available` — every mapper name
the process's `ClaimMapperRegistry` carries, the same registry ID token and
`/userinfo` issuance assemble claims from — and `bound`, the names this
tenant bound to this scope, empty when the scope has no binding rows and
falls back to whichever mappers declare it, which `declared` names. `PUT`
replaces the whole binding set and answers the same shape; binding a name the registry does not carry answers `400`, listing the
known names.

**`If-Match` is mandatory here, not optional.** This route replaces an
authorization-bearing list whole, so a stale write reinstates exactly what
another administrator has just removed; the header comes from the matching
`GET`, which answers an `ETag` over the same list. Absent, the request is
refused with `428 Precondition Required` and nothing is changed; stale,
with `412`. The list is read under the same lock the replacement runs
under, so two callers sent at once are serialised — the second sees what
the first wrote rather than matching the same pre-write state.

A scope with no bindings is unaffected by another scope's: binding `sub`
to one scope narrows only that scope's own claims, never `email`'s or any
other scope's in the same tenant.

`declared` names the mappers that declare the scope, the ones issuance runs for it
while `bound` is empty. It comes from code, so a write never changes it and the
`ETag` does not cover it, as it does not cover `available`.

In `scope-reach-demo`. The scope `email`
(`01a12d29-70d3-7b41-8b8f-2b3bcf07e79d`) is one every tenant starts with, and
the `email` mapper declares it; `billing`
(`01a12d29-72a6-77f6-9e8b-c2fcbb928cd2`) is declared by none. The read, then the
write under its tag, then the read back:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-70d3-7b41-8b8f-2b3bcf07e79d/mappers

curl -sS -D - -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "59c1141bb2da82132d257ffa8b417c0a7c4e9985057f06388c4d62534ecb2183"' \
  -d '{"mapper_names": ["sub"]}' \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-70d3-7b41-8b8f-2b3bcf07e79d/mappers

curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-70d3-7b41-8b8f-2b3bcf07e79d/mappers
```

The empty `bound` on the first read is the fallback case, not an error: `email`
runs for this scope until something is bound. Binding `sub` replaces it, and
`declared` still names `email`:

```
HTTP/1.1 200 OK
x-request-id: 01a12d29-9b02-721b-93cd-cb20e533372b
cache-control: no-store
etag: "59c1141bb2da82132d257ffa8b417c0a7c4e9985057f06388c4d62534ecb2183"
content-type: application/json; charset=utf-8
content-length: 106
Date: Tue, 27 Oct 2026 01:42:17 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"available":["sub","profile","email","roles","groups","address","phone"],"bound":[],"declared":["email"]}
HTTP/1.1 200 OK
x-request-id: 01a12d29-9b36-777e-8b19-641e3f840103
cache-control: no-store
etag: "e853268082f466e074aba6be62bd16b45ac4a0037e40335ae4eaf476c9defcb4"
content-type: application/json; charset=utf-8
content-length: 111
Date: Tue, 27 Oct 2026 01:42:17 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"available":["sub","profile","email","roles","groups","address","phone"],"bound":["sub"],"declared":["email"]}
HTTP/1.1 200 OK
x-request-id: 01a12d29-9b55-74f9-a386-3516a179a75a
cache-control: no-store
etag: "e853268082f466e074aba6be62bd16b45ac4a0037e40335ae4eaf476c9defcb4"
content-type: application/json; charset=utf-8
content-length: 111
Date: Tue, 27 Oct 2026 01:42:17 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"available":["sub","profile","email","roles","groups","address","phone"],"bound":["sub"],"declared":["email"]}
```

On `billing`, which no mapper declares, `declared` is empty and so is the
fallback; the same write without the header is refused:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-72a6-77f6-9e8b-c2fcbb928cd2/mappers

curl -sS -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mapper_names": ["sub"]}' \
  http://localhost:3082/admin/tenants/scope-reach-demo/scopes/01a12d29-72a6-77f6-9e8b-c2fcbb928cd2/mappers
```

```
{"available":["sub","profile","email","roles","groups","address","phone"],"bound":[],"declared":[]}

{"type":"about:blank","title":"Precondition Required","status":428,"detail":"If-Match is required to replace a scope’s claim mapper bindings","instance":"01a12d29-b389-725f-abd1-4064b5d48e63"}
```

A name the registry does not carry, refused with the names it does, on the
`billing` scope in its `demo`, under the `ETag` its `GET …/mappers` answered:

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "59c1141bb2da82132d257ffa8b417c0a7c4e9985057f06388c4d62534ecb2183"' \
  -d '{"mapper_names": ["nonesuch"]}' \
  http://localhost:3080/admin/tenants/demo/scopes/01a0ea5d-c42a-723c-8bb2-b45950186b42/mappers
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"unknown mapper name(s): nonesuch; known: sub, profile, email, roles, groups, address, phone","errors":[{"path":"mapper_names","message":"names no registered mapper nonesuch"}],"instance":"01a0ea5e-0ac9-7763-81a3-db353b147f0c"}
```
