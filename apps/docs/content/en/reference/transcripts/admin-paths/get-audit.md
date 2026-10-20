---
title: 'GET /audit'
description: "Requires view-audit, which carries no manage- counterpart: nothing ever amends a row here, only reap deletes one once it is older than the tenant's…"
---

# `GET /audit`

Requires `view-audit`, which carries no `manage-` counterpart: nothing ever
amends a row here, only `reap` deletes one once it is older than the
tenant's own `audit_retention_days` setting. Every admin mutation above
writes exactly one row here, in the same transaction as the change itself —
a client's `POST`, `PATCH`, `DELETE` and secret rotation; a tenant's
`POST` and its own `PATCH /settings`; and the equivalent for subjects,
roles, groups, scopes, scope mappers, sessions, signing keys, the flow and
SMTP configuration. `detail` is a redacted before/after diff, allowlisted
per resource type: a secret, a password hash or a private key never
appears in it, whichever of the two it would have been, and a field on
neither list is absent rather than shown.

**Which event types are stored is the tenant's `audit_event_types`
setting**, a list drawn from the six types `?event_type=` filters on, every
one by default. `PATCH /settings` takes it as an array (and
`odudu seed tenant --set audit_event_types=…` comma-separated), and it is
answered in the order the types are listed here: `admin_mutation`,
`admin_access`, `authentication`, `session`, `token`, `credential`. The
audit writer (`auditRepository`, `packages/domain-audit/src/repository/audit.ts`)
reads it in the transaction that writes each row, so **a change applies from
the moment it is saved**, to the next event on, and **it never deletes a row
already stored** — those stay until `audit_retention_days` takes them.
`admin_mutation` and `admin_access` are always stored: a value leaving
either out is refused with `400`, the error naming `audit_event_types`, and
a CHECK on the column refuses it again underneath. A security trail an
attacker holding an administrator's token could switch off is no trail.

Against the twelfth stack, in a tenant `audit-types-demo` made for it with
`ivy` seeded there by `odudu seed user`, so its trail holds nothing else:
`ivy` signs in once through the tenant's `odudu-admin` client (the
sign-in "Getting the token" shows), the counts of three types are read,
`authentication` and `session` are left out — named in another order, and
answered in the listed one — a value leaving out `admin_mutation` is
refused, `ivy` signs in again, and the counts are read again. The new
sign-in wrote its `token` row and nothing of the two types left out, and
the rows already stored are still there:

```bash
for t in authentication session token; do
  echo "$t $(curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit/count?event_type=$t")"
done
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"audit_event_types":["token","admin_access","admin_mutation","credential"]}' \
  "$P/settings" | jq -c '{audit_event_types}'
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"audit_event_types":["admin_access","token"]}' "$P/settings"; echo
```

`$P` is `http://localhost:3082/admin/tenants/audit-types-demo`, and the
`for` loop ran once before the two `PATCH`es and once after the second
sign-in:

```
authentication {"count":1,"capped":false}
session {"count":1,"capped":false}
token {"count":1,"capped":false}
{"audit_event_types":["admin_mutation","admin_access","token","credential"]}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"1 tenant setting(s) refused, listed under errors","errors":[{"path":"audit_event_types","message":"must include admin_mutation and admin_access, which can never be turned off; admin_mutation is missing"}],"instance":"01a109f6-7586-7863-93ba-e73e8b24afc1"}
authentication {"count":1,"capped":false}
session {"count":1,"capped":false}
token {"count":2,"capped":false}
```

**Each row names its actor when it is read**, beside the ids it stores:
`actor_name` is a user's username, or the `client_id` whose service account
the actor is, resolved within the row's own tenant at read time and never
written with the row — so the trail stays append-only, and a deleted
subject's name leaves with it, `null` from then on. `actor_origin` says where
the actor came from: `tenant`, this tenant; `system`, a system administrator
acting across tenants; `other-tenant`, the subject of a foreign token
refused at the door. A name is never resolved outside the row's tenant: an
auditor of a tenant reads no other tenant's subjects anywhere else, so a
system administrator appears as `system` with the id alone, and a system
auditor reads that name in `system`'s own trail. A name is a username,
which reading takes `view-users` everywhere else, so a caller holding
`view-audit` without it reads `actor_name` as `null` on every row, with
`actor_origin` still set — the same rule that masks a recipient under
`GET /mail`. `GET /clients/:id/evaluate` and `DELETE /sessions` above show a
`system` and a `tenant` actor, and `GET /audit/export` below a deleted one.
The older transcripts of this listing in this document and in
[the request paths](../request-paths/index.md) were recaptured against the tenth
stack once the two fields were added, each saying so where it appears; those
in [the console paths](../console-paths/index.md) say at the block that they
predate them.

Against the tenth stack, `ivy`, seeded in `ops-demo` with `odudu seed user`
and granted `odudu-admin:view-audit` alone (`$IVY_TOKEN`), reads the row
`DELETE /sessions` above left, then `$ADMIN_TOKEN` reads the same row:

```bash
curl -sS -H "Authorization: Bearer $IVY_TOKEN" "$P/whoami"; echo
curl -sS -H "Authorization: Bearer $IVY_TOKEN" "$P/audit?action=session.end_all&limit=1"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit?action=session.end_all&limit=1"; echo
```

```
{"subjectId":"01a0eea2-0572-77d8-b198-1cd4eae2caff","issuerTenantId":"01a0ee8a-c394-7b49-942b-3dea70a962e7","capabilities":["view-audit"],"crossTenant":false}
{"items":[{"id":"01a0ee8c-5548-7fd9-8179-8d3d1320b981","occurred_at":"2026-09-29T19:02:49.371Z","event_type":"admin_mutation","action":"session.end_all","outcome":"allowed","actor_tenant_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","actor_subject_id":"01a0ee8a-ca97-7a85-b36d-e23f6a8ae2d3","actor_client_id":"01a0ee8a-c3a0-7429-ab4a-4ecef6baf694","actor_name":null,"actor_origin":"tenant","resource_type":"tenant","resource_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","request_id":"01a0ee8c-550b-776a-8847-5fcfd763a5d1","ip":"172.22.0.1","detail":{"ended":4,"remaining":0,"beyond_ceiling":1}}]}
{"items":[{"id":"01a0ee8c-5548-7fd9-8179-8d3d1320b981","occurred_at":"2026-09-29T19:02:49.371Z","event_type":"admin_mutation","action":"session.end_all","outcome":"allowed","actor_tenant_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","actor_subject_id":"01a0ee8a-ca97-7a85-b36d-e23f6a8ae2d3","actor_client_id":"01a0ee8a-c3a0-7429-ab4a-4ecef6baf694","actor_name":"sam","actor_origin":"tenant","resource_type":"tenant","resource_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","request_id":"01a0ee8c-550b-776a-8847-5fcfd763a5d1","ip":"172.22.0.1","detail":{"ended":4,"remaining":0,"beyond_ceiling":1}}]}
```

`outcome` is `allowed`, `refused` or `failed`. Three kinds of mutation
refusal record an `admin_mutation` row. **`POST /clients`** does — a
reserved `client_id`, metadata `parseClientMetadata` rejects, or a tenant at
its client capacity. So does **every capability ceiling**: `POST /groups`
and `PATCH /groups/{id}` choosing a parent, `PUT /subjects/{id}/roles`,
`PUT /groups/{id}/roles`, `PUT /scopes/{id}/roles` and
`POST /roles/{id}/composites`; every removal judged by what it removes; the
target ceiling on every non-`GET` route under `/subjects/{id}`; and the
same ceiling on a client's service account — each writing a row whose
`detail.denied` names the capabilities the caller does not hold. And so
does **every `409` guarding the built-in admin surface**
(`builtin_admin_guarded`, the `openid` scope's delete and disabling the
system tenant), with the refusal's text under `detail.reason`, since the
caller is authenticated (ADR 0037's amendment of 2026-09-28). An attempted
privilege escalation is the refusal worth recording even while refusals in
general are not. Every other mutation above writes an `admin_mutation` row
only when it succeeds; `?outcome=refused` against a resource type with none
of those doors returns no `admin_mutation` row, not because nothing was
refused.

The door in front of every route records two refusals of its own, as
`admin_access` rows, whatever the route. A **`403`** to an authenticated
caller writes `capability.refused`, reads included, with `detail.capability`
naming the capability the caller lacked — `manage-tenants` when a system
admin without it reaches another tenant, the route's own otherwise. A
**`401` for a genuine token from another tenant** of this deployment writes
`token.foreign_issuer` into the tenant it was presented at, below. Every
other `401` — no token, a malformed or forged one, an issuer this
deployment does not serve, a dead session — writes no row, only a `warn`
log line naming the reason: the caller has proved nothing, so a row per
request would be theirs to append at will (ADR 0037).

`tenant_id` on a row is the tenant the change was made **to**, not the
tenant of whoever made it. `actor_tenant_id` and `actor_client_id` name the
caller instead — the tenant that issued the caller's own token and the
admin client it authenticated as — so a system admin's change to this
tenant is a row this tenant's own administrators can read, and can see was
made by someone outside it.

Paginated the same way every other list here is, over
`(occurred_at, id)` descending rather than ascending `id`: newest first.
Filters narrow the page rather than requiring one: `event_type`,
`actor_subject_id`, `resource_type`, `resource_id`, `action`, `outcome`, and
a `from`/`to` range on `occurred_at` (ISO 8601, with an offset). `event_type`
must be one of the vocabulary's own six values (`admin_mutation`,
`admin_access`, `authentication`, `session`, `token`, `credential`) and
`actor_subject_id` must be a UUID, since the column is one — either answers
`400` rather than reaching Postgres and failing there. `resource_id` is
text, not a UUID: a reserved-`client_id` refusal names it by the string the
caller sent, and an `authentication_session` row by a sha256 digest, so the
column is never narrower than what it holds
([What a refused login leaves behind](../request-paths/path-a-authorization-code-with-pkce.md#what-a-refused-login-leaves-behind)).
`resource_id` alone is ambiguous — a client, a role and a group can all
happen to share an id — so it answers `400` naming both fields unless
`resource_type` is given alongside it, the same way a cursor minted under
one filter set is refused when `resource_id` is added to it on replay.
`request_id` and `ip` are never filters. Both default from the request that made the change (`withTenant`'s
own `RequestContext`, `packages/db/src/tx.ts`): `request_id` is the
request's own id, which a caller may supply as `x-request-id` (truncated to
128 characters), and `ip` is `request.ip`, which only `ODUDU_TRUST_PROXY`
lets a forwarded header decide. So `request_id` correlates rows and `ip` is
the evidence: a join on `request_id` holds for requests you made or that
came through a proxy you trust, and shows only what the caller claimed for
anyone else's (ADR 0037's third amendment).

**A third stack.** The examples below — this section only — were re-run
against a third stack, brought up the same way from an empty volume, to
show `request_id`/`ip` filled in and the `event_type` filter working; nothing
elsewhere in this document was recaptured, so this stack's ids refer only
to each other and to nothing in the sections above or below. Its `demo` is
`01a0daef-a94a-7ff3-a8d5-e78a1d2764f8`, `ada` in the `system` tenant is
subject `01a0daee-7bfc-7f6c-90de-d72b0aa3b5d8`, and the `odudu-admin` client
she authenticated as is `01a0daee-7bb4-7abb-99dd-12bbd701c5d4`. Requests
below went from the host into the container over the compose network, so
`ip` is that network's own gateway address rather than `127.0.0.1`.

Recaptured against the twelfth stack, once a client's diff carried the
fields `0084` to `0086` added, after the same writes were made in a tenant
`audit-demo` created there for them — `demo-backend` with a `jwks`,
`demo-app`, the reserved `client_id` refused, then a key staged, promoted
and the old one retired — so the ids below are that run's, not the third
stack's, and the actor is `ada-t8c2`. `actor_origin` is
`system` on every row, and `actor_name` `null`, a system administrator
being named only in `system`'s own trail:

```bash
curl -sS -G \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "resource_type=client" \
  --data-urlencode "action=client.create" \
  --data-urlencode "limit=20" \
  http://localhost:3082/admin/tenants/audit-demo/audit; echo
```

All three `client.create` rows on this stack, newest first: the
reserved-`client_id` refusal, attempted last, then `demo-app` and
`demo-backend` below it — both created directly through `POST /clients`,
oldest last:

```
{"items":[{"id":"01a109b8-77c8-7c97-8aa7-deac1a7668cf","occurred_at":"2026-10-05T01:40:46.664Z","event_type":"admin_mutation","action":"client.create","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"odudu-admin","request_id":"01a109b8-77be-7a55-a1e9-0d79829206cc","ip":"172.22.0.1","detail":{}},{"id":"01a109b8-77af-76a9-af36-20575e2d2b9c","occurred_at":"2026-10-05T01:40:46.628Z","event_type":"admin_mutation","action":"client.create","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"01a109b8-77a5-71da-a011-fbe99903f2b4","request_id":"01a109b8-7799-7eb6-920d-379e0a60f39b","ip":"172.22.0.1","detail":{"jwks":{"changed":true},"name":{"after":"demo-app"},"type":{"after":"public"},"enabled":{"after":true},"tos_uri":{"after":null},"jwks_uri":{"after":null},"audiences":{"after":[]},"client_uri":{"after":null},"policy_uri":{"after":null},"description":{"after":null},"grant_types":{"after":["authorization_code"]},"web_origins":{"after":[]},"redirect_uris":{"after":["https://app.example/callback"]},"default_max_age":{"after":null},"require_auth_time":{"after":false},"full_scope_allowed":{"after":false},"id_token_ttl_seconds":{"after":null},"backchannel_logout_uri":{"after":null},"frontchannel_logout_uri":{"after":null},"access_token_ttl_seconds":{"after":null},"client_credentials_scopes":{"after":[]},"post_logout_redirect_uris":{"after":[]},"refresh_token_ttl_seconds":{"after":null},"token_endpoint_auth_method":{"after":"none"},"id_token_signed_response_alg":{"after":null}}},{"id":"01a109b8-7782-77bc-9ca1-9d946717fefc","occurred_at":"2026-10-05T01:40:46.472Z","event_type":"admin_mutation","action":"client.create","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"01a109b8-7778-7d05-a7d7-4bc8c614b862","request_id":"01a109b8-76fd-7d6d-a3a0-2473f5d37820","ip":"172.22.0.1","detail":{"jwks":{"changed":true},"name":{"after":"demo-backend"},"type":{"after":"confidential"},"enabled":{"after":true},"tos_uri":{"after":null},"jwks_uri":{"after":null},"audiences":{"after":[]},"client_uri":{"after":null},"policy_uri":{"after":null},"description":{"after":null},"grant_types":{"after":["client_credentials"]},"web_origins":{"after":[]},"redirect_uris":{"after":[]},"default_max_age":{"after":null},"require_auth_time":{"after":false},"full_scope_allowed":{"after":false},"id_token_ttl_seconds":{"after":null},"backchannel_logout_uri":{"after":null},"frontchannel_logout_uri":{"after":null},"access_token_ttl_seconds":{"after":null},"client_credentials_scopes":{"after":[]},"post_logout_redirect_uris":{"after":[]},"refresh_token_ttl_seconds":{"after":null},"token_endpoint_auth_method":{"after":"private_key_jwt"},"id_token_signed_response_alg":{"after":null}}}]}
```

`actor_tenant_id` is `system` on all three, and `tenant_id` is absent from
the row's own representation — the tenant a row belongs to is the one in
the path. None of the three `detail`s carries a secret: the refusal's is
empty, there being no row to diff, and `demo-backend` was created with
one — the allowlist shows `jwks` as `{"changed": true}` rather than a
value, which is the shape every redacted field takes. Every `request_id`
is a real request id and every `ip` the container's own view of the
caller.

Three signing-key rows from a stage/promote/retire rotation on this same
stack, narrowed by `resource_type` alone. Their `detail` is empty, a key
having no allowlisted field to diff:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "resource_type=signing_key" \
  http://localhost:3082/admin/tenants/audit-demo/audit; echo
```

```
{"items":[{"id":"01a109b8-785d-7bf7-bcdf-19fb0836e064","occurred_at":"2026-10-05T01:40:46.807Z","event_type":"admin_mutation","action":"key.retire","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"signing_key","resource_id":"01a109b8-76ec-74e6-a029-ecff623b8d80","request_id":"01a109b8-784f-7cab-88a6-10b1d5eb21c1","ip":"172.22.0.1","detail":{}},{"id":"01a109b8-7845-7d5b-bf6f-c7d2895629e6","occurred_at":"2026-10-05T01:40:46.786Z","event_type":"admin_mutation","action":"key.promote","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"signing_key","resource_id":"01a109b8-7825-7a6a-a1c9-43a7595d4817","request_id":"01a109b8-7839-7840-bd5d-b935524f7cea","ip":"172.22.0.1","detail":{}},{"id":"01a109b8-7827-7d57-9cfe-16ca0fb3b8c7","occurred_at":"2026-10-05T01:40:46.710Z","event_type":"admin_mutation","action":"key.create","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"signing_key","resource_id":"01a109b8-7825-7a6a-a1c9-43a7595d4817","request_id":"01a109b8-77eb-7a5d-86bd-2648f8c75b2a","ip":"172.22.0.1","detail":{}}]}
```

And `?outcome=refused`, non-empty for `POST /clients`: the same
reserved-`client_id` row shown above, on its own —
`resource_id` is the `client_id` string, there being no row to name:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "resource_type=client" \
  --data-urlencode "outcome=refused" \
  http://localhost:3082/admin/tenants/audit-demo/audit; echo
```

```
{"items":[{"id":"01a109b8-77c8-7c97-8aa7-deac1a7668cf","occurred_at":"2026-10-05T01:40:46.664Z","event_type":"admin_mutation","action":"client.create","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"odudu-admin","request_id":"01a109b8-77be-7a55-a1e9-0d79829206cc","ip":"172.22.0.1","detail":{}}]}
```

Adding `event_type=admin_mutation` to the first query on this stack —
`resource_type=client&action=client.create` — answers the same three rows
byte for byte, since every `client` mutation writes an `admin_mutation`
row and no other kind. The session `DELETE` is the one admin endpoint that
also writes a row of another kind, a `session` row beside its own:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "event_type=admin_mutation" \
  --data-urlencode "resource_type=client" \
  --data-urlencode "action=client.create" \
  http://localhost:3082/admin/tenants/audit-demo/audit; echo
```

```
{"items":[{"id":"01a109b8-77c8-7c97-8aa7-deac1a7668cf","occurred_at":"2026-10-05T01:40:46.664Z","event_type":"admin_mutation","action":"client.create","outcome":"refused","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"odudu-admin","request_id":"01a109b8-77be-7a55-a1e9-0d79829206cc","ip":"172.22.0.1","detail":{}},{"id":"01a109b8-77af-76a9-af36-20575e2d2b9c","occurred_at":"2026-10-05T01:40:46.628Z","event_type":"admin_mutation","action":"client.create","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"01a109b8-77a5-71da-a011-fbe99903f2b4","request_id":"01a109b8-7799-7eb6-920d-379e0a60f39b","ip":"172.22.0.1","detail":{"jwks":{"changed":true},"name":{"after":"demo-app"},"type":{"after":"public"},"enabled":{"after":true},"tos_uri":{"after":null},"jwks_uri":{"after":null},"audiences":{"after":[]},"client_uri":{"after":null},"policy_uri":{"after":null},"description":{"after":null},"grant_types":{"after":["authorization_code"]},"web_origins":{"after":[]},"redirect_uris":{"after":["https://app.example/callback"]},"default_max_age":{"after":null},"require_auth_time":{"after":false},"full_scope_allowed":{"after":false},"id_token_ttl_seconds":{"after":null},"backchannel_logout_uri":{"after":null},"frontchannel_logout_uri":{"after":null},"access_token_ttl_seconds":{"after":null},"client_credentials_scopes":{"after":[]},"post_logout_redirect_uris":{"after":[]},"refresh_token_ttl_seconds":{"after":null},"token_endpoint_auth_method":{"after":"none"},"id_token_signed_response_alg":{"after":null}}},{"id":"01a109b8-7782-77bc-9ca1-9d946717fefc","occurred_at":"2026-10-05T01:40:46.472Z","event_type":"admin_mutation","action":"client.create","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"01a109b8-7778-7d05-a7d7-4bc8c614b862","request_id":"01a109b8-76fd-7d6d-a3a0-2473f5d37820","ip":"172.22.0.1","detail":{"jwks":{"changed":true},"name":{"after":"demo-backend"},"type":{"after":"confidential"},"enabled":{"after":true},"tos_uri":{"after":null},"jwks_uri":{"after":null},"audiences":{"after":[]},"client_uri":{"after":null},"policy_uri":{"after":null},"description":{"after":null},"grant_types":{"after":["client_credentials"]},"web_origins":{"after":[]},"redirect_uris":{"after":[]},"default_max_age":{"after":null},"require_auth_time":{"after":false},"full_scope_allowed":{"after":false},"id_token_ttl_seconds":{"after":null},"backchannel_logout_uri":{"after":null},"frontchannel_logout_uri":{"after":null},"access_token_ttl_seconds":{"after":null},"client_credentials_scopes":{"after":[]},"post_logout_redirect_uris":{"after":[]},"refresh_token_ttl_seconds":{"after":null},"token_endpoint_auth_method":{"after":"private_key_jwt"},"id_token_signed_response_alg":{"after":null}}}]}
```

`?event_type=token`, a vocabulary event type no admin route writes,
answers an empty page rather than an error:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "event_type=token" \
  http://localhost:3000/admin/tenants/demo/audit
```

```
{"items":[]}
```

A value the vocabulary does not name answers `400`, the same shape
`querystring` validation already answers elsewhere in this document:

Captured against the sixth stack's `demo`:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "event_type=bogus" \
  http://localhost:3080/admin/tenants/demo/audit
```

```
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/event_type must be equal to one of the allowed values","errors":[{"path":"event_type","message":"must be equal to one of the allowed values"}],"instance":"01a0ea61-337e-7cec-8b3c-06ea3a078323"}
```

`resource_id` narrows further, and requires `resource_type` alongside it —
captured on the same third stack, rebuilt for this branch, with a fresh
system-tenant admin (`resource-doc`) and a tenant created only for this
subsection, `resource-audit-1790486559`, so its trail holds nothing but
what it did: two clients, `resource-doc-a` and `resource-doc-b`.

Recaptured against the twelfth stack in a tenant `resource-audit`, created
there with the same two clients by `ada-t8c2`, so the id is that run's:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "resource_type=client" \
  --data-urlencode "resource_id=01a109b8-7923-7e91-a66b-30136311418b" \
  http://localhost:3082/admin/tenants/resource-audit/audit; echo
```

Only `resource-doc-a`'s own row, not `resource-doc-b`'s:

```
{"items":[{"id":"01a109b8-792c-70bc-a0df-1cb04897ed0a","occurred_at":"2026-10-05T01:40:46.984Z","event_type":"admin_mutation","action":"client.create","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a109b4-0995-7d14-bb7f-6176df2e4d18","actor_client_id":"01a109b4-095b-7501-8dea-df1b55815aaf","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"01a109b8-7923-7e91-a66b-30136311418b","request_id":"01a109b8-78ff-7c5c-89ef-851e27a0902e","ip":"172.22.0.1","detail":{"jwks":{"changed":true},"name":{"after":"resource-doc-a"},"type":{"after":"confidential"},"enabled":{"after":true},"tos_uri":{"after":null},"jwks_uri":{"after":null},"audiences":{"after":[]},"client_uri":{"after":null},"policy_uri":{"after":null},"description":{"after":null},"grant_types":{"after":["client_credentials"]},"web_origins":{"after":[]},"redirect_uris":{"after":[]},"default_max_age":{"after":null},"require_auth_time":{"after":false},"full_scope_allowed":{"after":false},"id_token_ttl_seconds":{"after":null},"backchannel_logout_uri":{"after":null},"frontchannel_logout_uri":{"after":null},"access_token_ttl_seconds":{"after":null},"client_credentials_scopes":{"after":[]},"post_logout_redirect_uris":{"after":[]},"refresh_token_ttl_seconds":{"after":null},"token_endpoint_auth_method":{"after":"client_secret_basic"},"id_token_signed_response_alg":{"after":null}}}]}
```

`resource_id` alone, with no `resource_type`, is refused — a client, a
role and a group could all happen to share this id, so which table it
names is not optional:

Captured against the sixth stack's `demo`, the id no row there names — the
refusal is of the query's shape, before any row is read:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/audit?resource_id=01a0e150-b9ec-70a9-8e34-663280fa0514"
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"resource_id requires resource_type","errors":[{"path":"resource_id","message":"resource_id requires resource_type"}],"instance":"01a0ea61-338a-77a5-9e7b-5e0b1470f049"}
```

No page above needed a `next`: the stack never had more than twenty rows of
any one scope.

## A token from another tenant, and a caller missing a capability

**A fourth stack.** This subsection only ran against the compose stack
[the request paths](../request-paths/path-a-authorization-code-with-pkce.md#what-a-refused-login-leaves-behind)'s
audit transcripts were captured on, whose `demo` is
`01a0db22-1c32-7d17-b351-697d7911033c`. That stack had no `system` tenant
until `seed admin --username ada` was run on it for this section, printing
subject `01a0dc0c-0167-709b-af07-e6eb529e8139`; `ada` then signed in the way
[Getting the token](./getting-the-token.md) shows, created a tenant `acme`
through `POST /admin/tenants`, and created a client `demo-operator` in
`demo` through `POST /clients` — `client_credentials`,
`client_secret_basic` — then gave it the admin audience through
`PATCH /clients/{id}` with `{"audiences": ["urn:odudu:params:admin-api"]}`.
`demo-operator` is `01a0dc0c-ec33-7e6a-bd79-339e8682bd86`, and holds no
capability in `demo`. Its ids refer only to each other.

`demo-operator`'s `client_credentials` token is a genuine `demo` token for
the admin API. Its payload, decoded as in
[Getting the token](./getting-the-token.md), and `demo` accepting it:

```
{
  "iss": "http://localhost:3000/tenants/demo",
  "sub": "01a0dc0c-ec16-7566-adfb-a8bf7681149c",
  "aud": [
    "urn:odudu:params:admin-api",
    "http://localhost:3000/tenants/demo"
  ],
  "client_id": "demo-operator",
  "scope": "",
  "iat": 1790398252,
  "exp": 1790398552,
  "jti": "01a0dc0d-4611-7720-b3fc-d5a5e84ba945",
  "grant_id": "01a0dc0d-4611-7720-b3fc-d5a43620011b"
}
```

```bash
curl -sS -H "Authorization: Bearer $DEMO_TOKEN" \
  http://localhost:3000/admin/tenants/demo/whoami
```

```
{"subjectId":"01a0dc0c-ec16-7566-adfb-a8bf7681149c","issuerTenantId":"01a0db22-1c32-7d17-b351-697d7911033c"}
```

Presented at `acme` instead, it is refused with the `401` a string that is
not a token at all gets. Both requests carry the same `x-request-id`, so the
two responses differ only in `Date`:

```bash
curl -sS -D - -H "Authorization: Bearer $DEMO_TOKEN" \
  -H 'x-request-id: foreign-issuer-doc' \
  http://localhost:3000/admin/tenants/acme/subjects
curl -sS -D - -H "Authorization: Bearer not-a-token" \
  -H 'x-request-id: foreign-issuer-doc' \
  http://localhost:3000/admin/tenants/acme/subjects
```

```
HTTP/1.1 401 Unauthorized
x-request-id: foreign-issuer-doc
content-type: application/problem+json; charset=utf-8
content-length: 90
Date: Sat, 26 Sep 2026 04:50:58 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Unauthorized","status":401,"instance":"foreign-issuer-doc"}
HTTP/1.1 401 Unauthorized
x-request-id: foreign-issuer-doc
content-type: application/problem+json; charset=utf-8
content-length: 90
Date: Sat, 26 Sep 2026 04:51:03 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Unauthorized","status":401,"instance":"foreign-issuer-doc"}
```

_(Not re-run for the `cache-control: no-store` pass: this and the two
blocks below share one continuous audit-trail narrative — `acme`'s and
`demo`'s `admin_access` rows accumulate on every real replay, since both
requests deliberately reuse the literal `x-request-id` values above rather
than minting fresh ones — and there is no way to clear an append-only
audit trail from the admin API. So the two blocks below were recaptured on
a stack where neither tenant's trail held anything yet, which is the one
way to reproduce the state the prose describes.)_

What tells them apart is behind the response. The first names an issuer
this deployment serves, and its signature verifies against `demo`'s own
keys, so it is recorded in `acme`'s trail — the tenant the attempt was made
against — naming `demo` as the caller's tenant, its subject and its client.
The second writes only a `warn` line to the server's log:

```
{"level":40,"time":1790398263230,"pid":1,"hostname":"bd66202e30bc","reqId":"foreign-issuer-doc","reason":"malformed_token","msg":"admin request unauthenticated"}
```

`acme` was created moments before, so its `admin_access` trail holds only
what this subsection did; `demo`'s holds nothing yet:

Recaptured against the tenth stack, once each row answered `actor_name` and
`actor_origin`, after the same requests were made there — `acme` created,
`demo-operator` created in its `demo` with the admin audience and no
capability, and its token presented at `acme` once — so the ids are that
run's, not the fourth stack's:

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "event_type=admin_access" \
  http://localhost:3082/admin/tenants/acme/audit; echo
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "event_type=admin_access" \
  http://localhost:3082/admin/tenants/demo/audit; echo
```

```
{"items":[{"id":"01a0ee96-113f-7bf0-a878-7fbd1bb8cb47","occurred_at":"2026-09-29T19:13:27.357Z","event_type":"admin_access","action":"token.foreign_issuer","outcome":"refused","actor_tenant_id":"01a0ee8f-032e-718b-b030-be2b154a9e99","actor_subject_id":"01a0ee96-104f-7c7f-b3da-d7049248b038","actor_client_id":"01a0ee96-1084-772b-b51a-848699f7a2e1","actor_name":null,"actor_origin":"other-tenant","resource_type":null,"resource_id":null,"request_id":"foreign-issuer-doc","ip":"172.22.0.1","detail":{"reason":"foreign_issuer"}}]}
{"items":[]}
```

The same token at `demo`, where it authenticates but holds no capability,
is a `403`, and `demo`'s trail now has the `capability.refused` row naming
what `GET /subjects` needed:

Recaptured against the tenth stack the same way, straight after the block
above:

```bash
curl -sS -D - -H "Authorization: Bearer $DEMO_TOKEN" \
  -H 'x-request-id: capability-refused-doc' \
  http://localhost:3082/admin/tenants/demo/subjects; echo
curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode "event_type=admin_access" \
  http://localhost:3082/admin/tenants/demo/audit; echo
```

```
HTTP/1.1 403 Forbidden
x-request-id: capability-refused-doc
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 91
Date: Tue, 29 Sep 2026 19:13:28 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Forbidden","status":403,"instance":"capability-refused-doc"}
{"items":[{"id":"01a0ee96-1551-7830-a44f-fd26a2050e16","occurred_at":"2026-09-29T19:13:28.400Z","event_type":"admin_access","action":"capability.refused","outcome":"refused","actor_tenant_id":"01a0ee8f-032e-718b-b030-be2b154a9e99","actor_subject_id":"01a0ee96-104f-7c7f-b3da-d7049248b038","actor_client_id":"01a0ee96-1084-772b-b51a-848699f7a2e1","actor_name":"demo-operator","actor_origin":"tenant","resource_type":null,"resource_id":null,"request_id":"capability-refused-doc","ip":"172.22.0.1","detail":{"reason":"missing_capability","capability":"view-users"}}]}
```

## Reads that are too broad, and instants that cannot be held

`GET /audit`, `GET /audit/count` and `GET /audit/export` walk one index, the one
serving the most selective filter, and filter by the rest. Two filters few rows share
(an action and an actor, say) leave Postgres reading all of the cheaper one, however
small the page. So each runs under a statement timeout of five seconds, set in its own
transaction and gone with it, and past it the answer is a `400` of type
`about:blank#audit-query-too-broad` whose `detail` says to narrow the time range with
`from` and `to`: they lead the time index, so a pair narrowed by them is cheap. It is a
`400` rather than a `503` because asking again unchanged can only fail the same way.
`from` and `to` are instants from 1970 to 9999; the year 0 that used to reach Postgres
as a `500` is refused at the door.

Against the twenty-third stack, compose project `odudu-docs-19` on port 3082, its
Postgres on 5464, built from this branch (the server as of `2918f960`) and brought up
from an empty volume, with `seed admin --username ada` and the token got the way
"Getting the token" shows. Twelve million rows were then inserted into `system`'s trail as
the database owner, half under the action `bulk.a` and an actor, half under `bulk.b`
and another, the last eight million fifty days older than the rest, and `analyze` run;
`$P` is `http://localhost:3082/admin/tenants/system` and `$A` the second actor,
`22222222-2222-4222-8222-222222222222`. Each response is followed by its `time_total`.
The same pair on four million rows took 2.5 s, so the bound is crossed from about
ten million, and a hundred million is some twenty-five times that:

```bash
curl -sS -D - -w "\n%{time_total} s\n" -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit?action=bulk.a&actor_subject_id=$A&limit=1"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a13cfd-82b0-7ec2-8445-39b5e544e774
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 251
Date: Thu, 15 Oct 2026 00:36:54 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank#audit-query-too-broad","title":"Bad Request","status":400,"detail":"these filters could not be searched within 5 seconds; narrow the time range with from and to, or drop a filter","instance":"01a13cfd-82b0-7ec2-8445-39b5e544e774"}
5.125595 s
```

The same filters with a ten minute window, which the time index serves, and the count, which
answered inside the bound this time, and the export, which did not:

```bash
curl -sS -D - -w "\n%{time_total} s\n" -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit?action=bulk.a&actor_subject_id=$A&from=2026-10-15T00:26:49Z&limit=1"
curl -sS -D - -w "\n%{time_total} s\n" -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit/count?action=bulk.a&actor_subject_id=$A"
curl -sS -D - -w "\n%{time_total} s\n" -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit/export?action=bulk.a&actor_subject_id=$A"
```

```
HTTP/1.1 200 OK
x-request-id: 01a13cfd-96c3-7f6d-8178-6164156d37b1
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 12
Date: Thu, 15 Oct 2026 00:36:54 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[]}
0.029296 s
```

```
HTTP/1.1 200 OK
x-request-id: 01a13cfd-96e7-76eb-9fd3-f4e2b838f8dc
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 26
Date: Thu, 15 Oct 2026 00:36:58 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"count":0,"capped":false}
4.107103 s
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a13cfd-a709-7603-815f-a3c9f0ad99a0
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 251
Date: Thu, 15 Oct 2026 00:37:03 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank#audit-query-too-broad","title":"Bad Request","status":400,"detail":"these filters could not be searched within 5 seconds; narrow the time range with from and to, or drop a filter","instance":"01a13cfd-a709-7603-815f-a3c9f0ad99a0"}
5.067626 s
```

And an instant before 1970, refused by the contract with a sentence naming the field and
the range, as the same `errors[]` every other admin `400` carries (recaptured on a
stack of its own, `odudu-docs-19` again, built from this branch after the change; the
count and the export answer the same with `to`):

```bash
curl -sS -D - -w "\n%{time_total} s\n" -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit?from=0000-01-01T00:00:00Z"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a13d62-c82f-7859-866d-bb29899ca1a1
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 241
Date: Thu, 15 Oct 2026 02:27:26 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Bad Request","status":400,"detail":"from must be a date between 1970 and 9999","errors":[{"path":"from","message":"from must be a date between 1970 and 9999"}],"instance":"01a13d62-c82f-7859-866d-bb29899ca1a1"}
0.022757 s
```

A year after 9999 is refused earlier, by the route's own date pattern rather than
the contract, so its `400` is titled `Error` and its `detail` is the pattern
itself, which accepts four-digit years only; `from`, the count and the export
answer the same. Captured against a stack of its own, the project
`odudu-fix18b` on port 3187, built from the tree at `126ad3b7` on an empty
volume with `seed admin --username ada`:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3187/admin/tenants/system/audit?to=10000-01-01T00:00:00Z"
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a140be-b3f5-7530-9aa8-b1346cc2c373
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 822
Date: Thu, 15 Oct 2026 18:06:42 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Error","status":400,"detail":"querystring/to must match pattern \"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$\"","errors":[{"path":"to","message":"must match pattern \"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$\""}],"instance":"01a140be-b3f5-7530-9aa8-b1346cc2c373"}
```

The stack was torn down with `docker compose down -v` when the capture finished.
