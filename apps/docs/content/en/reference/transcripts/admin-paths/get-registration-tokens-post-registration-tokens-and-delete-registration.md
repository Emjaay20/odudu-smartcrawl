---
title: 'GET /registration-tokens, POST /registration-tokens and…'
description: 'All three require manage-clients, the same capability the client routes above need — an initial access token is configuration for dynamic…'
---

## `GET /registration-tokens`, `POST /registration-tokens` and `DELETE /registration-tokens/:id`

All three require `manage-clients`, the same capability the client routes
above need — an initial access token is configuration for dynamic
registration, not a population of its own. `POST` mints one:
`{"uses": <int, 1–2147483647>, "ttl_seconds": <int, 60–31536000>}` — a
year is this project's own ceiling on how long a bootstrap credential may
outlive the operator who minted it, not a protocol or storage limit —
answering `201` with `id`, `token`, `remaining_uses` and `expires_at`.
**This is the only response, from any route, that ever carries `token`** —
a following `GET` lists `id`, `remaining_uses`, `created_at` and
`expires_at` and nothing else, the plaintext is never logged, and it never
appears in an audit `detail`. `DELETE` revokes one by `id`, answering
`204`, or `404` if the id names no _live_ token — one already spent to
zero uses or expired answers `404` the same way an id nothing ever minted
does, since `GET` was already hiding it from the caller.

`GET` never lists a token that has been spent to zero uses or has expired — the
same two conditions `spend` already refuses under, so the list a caller sees is
exactly the set of tokens that would still redeem. It pages in SQL, like every
other listing here: a page anchored on a token that has since expired, been
spent out or been revoked still resumes from the same place, because the cursor
is a plain `id` comparison rather than a position inside a snapshot of the whole
set. Minting records `uses` and `ttl_seconds` in the audit trail; revoking
records what was revoked (`remaining_uses`, `expires_at`) the same way a
client's own amendment does, through the same allowlisted diff — never the token
or its hash, on either action.

`demo`'s own policy is `disabled`; this run opens it to `token` first, the same
door `PATCH /settings` opens to `open` for the sections above, and closes it
again at the end, in the same transcript:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_registration_policy": "token"}' \
  http://localhost:3000/admin/tenants/demo/settings > /dev/null

curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uses": 1, "ttl_seconds": 3600}' \
  http://localhost:3000/admin/tenants/demo/registration-tokens
```

```
{"id":"01a0e1bd-1658-7dd7-a886-e6d701026191","token":"iMpoXXUt6YF1ioil8i0eI8b912sLAHPjNLISdtXG1Eo","remaining_uses":1,"expires_at":"2026-09-27T08:21:00.760Z"}
```

Listing right after shows the same token with no `token` field, and
presenting it at `/tenants/demo/clients-registrations/openid-connect`
registers a client:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/registration-tokens
curl -sS -X POST \
  -H "Authorization: Bearer iMpoXXUt6YF1ioil8i0eI8b912sLAHPjNLISdtXG1Eo" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://rp.example/cb"]}' \
  http://localhost:3000/tenants/demo/clients-registrations/openid-connect
```

```
{"items":[{"id":"01a0e1bd-1658-7dd7-a886-e6d701026191","remaining_uses":1,"created_at":"2026-09-27T07:21:00.759Z","expires_at":"2026-09-27T08:21:00.760Z"}]}
{"client_id":"01a0e1bd-2763-78a3-bf18-de64780558d8","client_id_issued_at":1790493665,"client_secret":"BvxM_Jnw2jU3gWyhMo-1tOVdAIJoOaBdqTdT7TCXTmM","client_secret_expires_at":0,"redirect_uris":["https://rp.example/cb"],"grant_types":["authorization_code"],"token_endpoint_auth_method":"client_secret_basic"}
```

A second, freshly minted token demonstrates the other half — `DELETE`,
then a registration attempt with the now-revoked token:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uses": 1, "ttl_seconds": 3600}' \
  http://localhost:3000/admin/tenants/demo/registration-tokens
```

```
{"id":"01a0e1bd-36f3-7e51-84a5-25d4b0b2d50e","token":"CCsWyDsal7TdxscIypKk4s0kG7Id6fsTTD2JW719oxU","remaining_uses":1,"expires_at":"2026-09-27T08:21:09.108Z"}
```

```bash
curl -sS -D - -o /dev/null -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/registration-tokens/01a0e1bd-36f3-7e51-84a5-25d4b0b2d50e \
  | grep -iE '^HTTP'
curl -sS -D - -o /dev/null -X POST \
  -H "Authorization: Bearer CCsWyDsal7TdxscIypKk4s0kG7Id6fsTTD2JW719oxU" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://rp.example/cb"]}' \
  http://localhost:3000/tenants/demo/clients-registrations/openid-connect \
  | grep -iE '^HTTP|www-authenticate'
```

```
HTTP/1.1 204 No Content
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer realm="client-registration", error="invalid_token"
```

The audit trail for that mint and that revoke, each scoped to the second
token's own `resource_id` so this prints only the row it describes rather
than every mint or revoke `demo` has ever recorded:

With `actor_name` and `actor_origin` on each row, after a token is minted in its
`demo` and revoked the same way, the id is a fresh run's, not the one above:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/audit?action=registration_token.mint&resource_type=registration_token&resource_id=01a0ee8f-0361-755d-b510-c9d6fde88a03"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/audit?action=registration_token.revoke&resource_type=registration_token&resource_id=01a0ee8f-0361-755d-b510-c9d6fde88a03"; echo
```

```
{"items":[{"id":"01a0ee8f-0362-7553-addc-3f32813a6ac1","occurred_at":"2026-09-29T19:05:45.056Z","event_type":"admin_mutation","action":"registration_token.mint","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"registration_token","resource_id":"01a0ee8f-0361-755d-b510-c9d6fde88a03","request_id":"01a0ee8f-0356-773a-bb66-91367ea0bff9","ip":"172.22.0.1","detail":{"uses":1,"ttl_seconds":3600}}]}
{"items":[{"id":"01a0ee8f-036e-7d81-bda1-1a6bc375bfde","occurred_at":"2026-09-29T19:05:45.068Z","event_type":"admin_mutation","action":"registration_token.revoke","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"registration_token","resource_id":"01a0ee8f-0361-755d-b510-c9d6fde88a03","request_id":"01a0ee8f-0366-718b-a606-cbb01d9513c9","ip":"172.22.0.1","detail":{"expires_at":{"before":"2026-09-29T20:05:45.057Z"},"remaining_uses":{"before":1}}}]}
```

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_registration_policy": "disabled"}' \
  http://localhost:3000/admin/tenants/demo/settings | head -c 60
```

```
{"display_name":"Demo","enabled":true,"registration_allowed"
```
