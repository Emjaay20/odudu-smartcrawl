---
title: 'POST /admin/tenants'
description: 'Creates a tenant: the row, its browser authentication flow (provisionTenant, @odudu/authn-flows) and its built-in admin client…'
---

# `POST /admin/tenants`

Creates a tenant: the row, its browser authentication flow
(`provisionTenant`, `@odudu/authn-flows`) and its built-in admin client
(`provisionAdminClient`, `@odudu/protocol-oidc`) in one call, so a tenant
this endpoint returns is one an operator can immediately provision an admin
for. `manage-tenants` is required, the same as the listing above.

A tenant name is a DNS label — 1-63 lowercase letters, digits or hyphens, never
starting or ending with one — because it is minted straight into an issuer host
segment; a shape a resolver would reject is refused with `400` before it ever
becomes one (`isValidTenantName`, `@odudu/domain-tenant`), and the same CHECK
stands behind it at the database (`tenants_name_dns_label`). `system` and
`count` are refused with `409` on top of that — reserved for the tenant this API
itself administers from, and for the collection route `GET /admin/tenants/count`
would otherwise shadow — rather than left to surface as a unique-index conflict;
`odudu seed tenant --name system` and `--name count` are refused for the
identical reasons (`isReservedTenantName`, `@odudu/domain-tenant`), as is
`seed({ tenant: 'system', … })`, the options form of the same command. A name
another tenant already holds is refused with `409` too — under row-level
security a tenant carrying it is not visible to this call, so the unique index
is what answers, mapped to the same shape rather than left to surface as a
`500`.

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "showcase", "display_name": "Showcase"}' \
  http://localhost:3080/admin/tenants
```

```
HTTP/1.1 201 Created
x-request-id: 01a0ea4d-c754-76a2-bbf6-ec2ae6386937
cache-control: no-store
etag: "2d683197c5f4fe27d0a0d6521f2038605964ad36a6d949d9962050fe63c463dd"
content-type: application/json; charset=utf-8
content-length: 144
Date: Mon, 28 Sep 2026 23:16:01 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0ea4d-c75e-7ac7-abe7-cdb5a6b2bbad","name":"showcase","display_name":"Showcase","enabled":true,"created_at":"2026-09-28T23:16:00.990Z"}
```

Whose `demo` had already been created by then, so the create above names a
tenant of its own, `showcase`. The `etag` header is the one `GET
/admin/tenants/showcase` answers.

Both refusals, against that same stack — the reserved name, then the name
the call above had just taken:

```bash
for n in system showcase; do
  curl -sS -X POST \
    -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$n\"}" \
    http://localhost:3080/admin/tenants
  echo
done
```

```
{"type":"about:blank","title":"Conflict","status":409,"detail":"the name \"system\" is reserved","instance":"01a0ea4d-e458-716d-b8f4-40f64c2a23d9"}
{"type":"about:blank","title":"Conflict","status":409,"detail":"the name \"showcase\" is already in use","instance":"01a0ea4d-e471-75f2-9cc8-f15b363d1512"}
```

And the DNS-label refusal — the request above with `Acme` in place of
`showcase`:

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme", "display_name": "Showcase"}' \
  http://localhost:3080/admin/tenants
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a0ea4d-e49a-7a63-811d-5bade0233aea
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 367
Date: Mon, 28 Sep 2026 23:16:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Bad Request","status":400,"detail":"a tenant name must be 1-63 lowercase letters, digits or hyphens, and must not start or end with a hyphen","errors":[{"path":"name","message":"a tenant name must be 1-63 lowercase letters, digits or hyphens, and must not start or end with a hyphen"}],"instance":"01a0ea4d-e49a-7a63-811d-5bade0233aea"}
```
