---
title: 'GET /clients, POST /clients and GET /clients/{id}'
description: 'Lists, reads and creates clients: the clients row and its OIDC configuration, joined into one resource keyed by the internal id.'
---

# `GET /clients`, `POST /clients` and `GET /clients/{id}`

Lists, reads and creates clients — the `clients` row and its OIDC
configuration (`client_oidc_config`), joined into one resource keyed by the
client's internal id (`{id}` above is that id, not the OAuth `client_id`
string a token request names). Requires `manage-clients` throughout: there
is no `view-clients`, because client metadata is configuration rather than
a population to browse. A `GET` on a single client carries an `ETag`, which
`PATCH /clients/{id}` below reads back through `If-Match`.

A create body names `client_id` — chosen by the operator, unlike RFC 7591
dynamic registration (`clients-registrations/openid-connect`, [the request
paths](../request-paths/bootstrap.md#dynamic-client-registration)) where the
server assigns it — plus the same RFC 7591 client metadata dynamic registration
accepts, narrowed by the identical validator (`parseClientMetadata`): a
`redirect_uris` entry it rejects, or `jwks` and `jwks_uri` sent together, is
refused here with the identical `400` detail. `odudu-admin` is refused as a
`client_id` with `409` — reserved for the built-in admin client every tenant is
provisioned with, and creation is a door dynamic registration never opens to it
in the first place, since RFC 7591 §2 already assigns `client_id` there and
refuses a caller that names one itself. A `client_id` that collides with an
existing client in the tenant is refused the same way, also `409`, rather than
surfacing as the database's own unique-index violation.

A create body may also carry any field `PATCH /clients/{id}` below amends —
`description`, `client_uri`, `policy_uri`, `tos_uri`, `audiences`,
`web_origins`, `post_logout_redirect_uris`, `client_credentials_scopes`,
`access_token_ttl_seconds`, `id_token_ttl_seconds`, `refresh_token_ttl_seconds`,
`consent_required`, `token_exchange_impersonation_allowed`, `enabled`,
`full_scope_allowed` and `name` — each checked by the identical validation
`PATCH` runs. A field `PATCH` refuses to amend, such as `type`, is refused here
with `PATCH`'s own reason; a key that names nothing on the client at all is
refused with `400` and the detail `<field>: <field> is not a client field`,
naming it rather than silently ignoring it; `name` sent alongside a different
`client_name` is refused the same way. `access_token_ttl_seconds` or
`id_token_ttl_seconds` outside 1 to 3600 and `refresh_token_ttl_seconds` below 1
are refused with `400`, naming the field, on a create and a `PATCH` alike — the
ranges the database's own CHECK constraints hold
(`0013_access_token_ttl_ceiling.sql`, `0014_refresh_token_ttl_floor.sql`,
`0082_tenant_lifetimes.sql`), which otherwise surfaced as a `500`. Each of the
three may be `null`, which a client created without one already is: the client
then takes the tenant's setting of the same name ([`GET
/settings`](./get-settings-and-patch-settings.md)). No transcript shows that
refusal; An integration test covers it.

A `jwks` is served public members only, by the read, the list and every response
that carries a client, the same stripping export applies (`publicJwks`).
Registration and this API refuse a private member, so only a row written before
they did can hold one; a `PATCH` that reruns the metadata is judged on the
stripped set, and writes it back without the member. No transcript shows it,
since none of these runs produced such a row; an integration test writes one
directly.

Creating a client that names both, against `demo`, then reading it back. In a
`demo` created there, which by then held the four clients the search below
names; the `etag` the create answers is the one the read does:

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "demo-fields-check", "grant_types": ["client_credentials"], "token_endpoint_auth_method": "client_secret_basic", "audiences": ["https://api.demo.example"], "web_origins": ["https://app.demo.example"]}' \
  http://localhost:3082/admin/tenants/demo/clients
```

```
HTTP/1.1 201 Created
x-request-id: 01a109b6-1ef6-7a6d-9ff9-def5b5fc82e3
cache-control: no-store
etag: "6dc2242735aedc4c4bf99f04c2a1daf815a9cfa968efd12044dd8728c3dd1851"
content-type: application/json; charset=utf-8
content-length: 2048
Date: Mon, 05 Oct 2026 01:38:12 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a109b6-1f4b-791e-8e05-536475239e30","client_id":"demo-fields-check","name":"demo-fields-check","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-27T01:06:12.713Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":["https://api.demo.example"],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":["https://app.demo.example"],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a109b6-1f0b-7a0b-89d2-3a6006154ef9","scopes":[{"id":"01a109b6-1d8f-7df7-a3ef-36164961fbbc","name":"openid","assignment":"default"},{"id":"01a109b6-1d90-79dd-bd97-5ff11a7bdada","name":"profile","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6243ce77a609","name":"email","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6244f8af75ca","name":"address","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e124a6313a","name":"phone","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e210286ad3","name":"roles","assignment":"default"},{"id":"01a109b6-1d93-7e58-971c-61e1c1e76586","name":"groups","assignment":"default"},{"id":"01a109b6-1d94-7b22-b794-705545e99aeb","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"PIow_RUQNYO4Q-4OHmsZPy6e_P-OhEU5pfE5Eyey5RM"}
```

`GET`ting it back shows both fields still set, from the row rather than the
create response — and now also carries `builtin_admin` and
`service_subject_id`, read from the same row a create response is:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/demo/clients/01a109b6-1f4b-791e-8e05-536475239e30
```

```
HTTP/1.1 200 OK
x-request-id: 01a109b6-1f70-75e5-be6f-a96d7f3859f7
cache-control: no-store
etag: "6dc2242735aedc4c4bf99f04c2a1daf815a9cfa968efd12044dd8728c3dd1851"
content-type: application/json; charset=utf-8
content-length: 1986
Date: Mon, 05 Oct 2026 01:38:12 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a109b6-1f4b-791e-8e05-536475239e30","client_id":"demo-fields-check","name":"demo-fields-check","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-27T01:06:12.713Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":["https://api.demo.example"],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":["https://app.demo.example"],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a109b6-1f0b-7a0b-89d2-3a6006154ef9","scopes":[{"id":"01a109b6-1d8f-7df7-a3ef-36164961fbbc","name":"openid","assignment":"default"},{"id":"01a109b6-1d90-79dd-bd97-5ff11a7bdada","name":"profile","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6243ce77a609","name":"email","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6244f8af75ca","name":"address","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e124a6313a","name":"phone","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e210286ad3","name":"roles","assignment":"default"},{"id":"01a109b6-1d93-7e58-971c-61e1c1e76586","name":"groups","assignment":"default"},{"id":"01a109b6-1d94-7b22-b794-705545e99aeb","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}
```

An unknown field, on the same tenant:

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "demo-bad-field", "grant_types": ["client_credentials"], "token_endpoint_auth_method": "client_secret_basic", "colour": "blue"}' \
  http://localhost:3080/admin/tenants/demo/clients
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a0ea52-011f-73ba-bd5f-6b38e61d7a99
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 225
Date: Mon, 28 Sep 2026 23:20:37 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Bad Request","status":400,"detail":"colour: colour is not a client field","errors":[{"path":"colour","message":"colour is not a client field"}],"instance":"01a0ea52-011f-73ba-bd5f-6b38e61d7a99"}
```

A tenant at its `max_clients` cap (`GET`/`PATCH /settings` above) refuses
creation here with `403`, the same cap `registerClient`'s own
`lockCapacity` enforces for dynamic registration — `manage-clients` and
`manage-tenant`, which sets the cap, are different capabilities, so this
door locks and counts for itself rather than trusting the two to be held
together.

Every client created through this door is recorded as
`registration_origin: "operator"` — distinct from the CLI's `"seeded"`, RFC
7591 open registration's `"anonymous"` and a registration token's
`"token"` — so the four ways a client came to exist stay told apart in the
one column that records it.

A confidential client (`token_endpoint_auth_method` anything but `none`) is
given a generated secret, returned **exactly once, in the creation
response**. Nothing reads it back afterward — `clients.secret_hash` is the
only thing stored.

The disable and delete guards further down read `builtin_admin`, and a client's
representation carries it and `service_subject_id` too. This create, the psql
listing and the disable/delete/rotate blocks under `PATCH /clients/{id}`,
`DELETE /clients/{id}` and `POST /clients/{id}/secret` below are one run, in a
tenant of their own, `client-facts-demo`, created for them the same way `GET
/admin/tenants` above shows, as `ada`, so the ids in them are that run's; the
`demo`-tenant blocks between them (the amendment and `If-Match` narrative) are
from another, and say so where they appear:

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "demo-backend", "grant_types": ["client_credentials"], "token_endpoint_auth_method": "client_secret_basic"}' \
  http://localhost:3082/admin/tenants/client-facts-demo/clients
```

`201`, the whole client, the tenant's default scope assignments, and the
one-time secret. The `scopes` ids are `client-facts-demo`'s own, created
with the tenant above:

```
HTTP/1.1 201 Created
x-request-id: 01a109b6-1f86-7bb5-9871-718e564d3bca
cache-control: no-store
etag: "608cbb937c55671ada467480ebde194cc7ddf52ec4d186428f7382010cc44f55"
content-type: application/json; charset=utf-8
content-length: 1986
Date: Mon, 05 Oct 2026 01:38:13 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a109b6-1fa9-7304-8ae5-f714f746785e","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-27T01:06:12.931Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a109b6-1f8f-725e-9c2c-53656397b36c","scopes":[{"id":"01a109b6-1dd0-7600-9e14-7816d44df6e6","name":"openid","assignment":"default"},{"id":"01a109b6-1dd0-7600-9e14-7817de7c7d68","name":"profile","assignment":"default"},{"id":"01a109b6-1dd1-715a-b073-4693dd489102","name":"email","assignment":"default"},{"id":"01a109b6-1dd1-715a-b073-4694a189e4be","name":"address","assignment":"default"},{"id":"01a109b6-1dd2-747c-97bd-c431358429af","name":"phone","assignment":"default"},{"id":"01a109b6-1dd2-747c-97bd-c432be4c4a58","name":"roles","assignment":"default"},{"id":"01a109b6-1dd3-7b41-8bf3-e8da34d0a2c0","name":"groups","assignment":"default"},{"id":"01a109b6-1dd3-7b41-8bf3-e8db9126a263","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"qcLswLhlRUkD_ovjYtrjwYoAufCdl54XUqznSvA2-x0"}
```

`client_secret` is the only member of that object nothing reads back.
`service_subject_id` is a confidential client's own service account,
created alongside it; `builtin_admin` is `false` here and `true` on the
tenant's own `odudu-admin`, read from the same column the disable and
delete guards below check, not asserted — the psql listing under
`PATCH /clients/{id}` shows both rows.

The reserved `client_id`, refused against `demo` (this tenant's own history,
from a separate run):

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "odudu-admin", "grant_types": ["client_credentials"], "token_endpoint_auth_method": "client_secret_basic"}' \
  http://localhost:3000/admin/tenants/demo/clients
```

```
{"type":"about:blank","title":"Conflict","status":409,"detail":"the client_id \"odudu-admin\" is reserved","instance":"01a0d6ff-8816-7f15-827d-118b7b6ee5ed"}
```

Listing pages the same way `GET /admin/tenants` does — `?limit=`, `?cursor=`,
ordered by `id`, a `Link: rel="next"` header and a `next` body member once a
further page exists, no total (`GET /clients/count` below has one). Here the
page held two clients, the tenant's own `odudu-admin` and `demo-backend` above:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/clients?limit=50
```

```
{"items":[{"id":"01a17add-fa29-747d-9960-8fe07e6a8912","client_id":"odudu-admin","name":"Odudu administration","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"seeded","created_at":"2026-10-27T00:58:50.257Z","redirect_uris":["http://127.0.0.1:8080/callback","http://localhost:3650/console/auth/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"private_key_jwt","audiences":["urn:odudu:params:admin-api"],"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":["http://localhost:3650/console/"],"jwks":{"keys":[{"x":"DpLEax1I1XO588egrDfzu4eYq11j3MyCa2Qu8-exgag","y":"Mjaadu-NjCgQ9dA6NK0-CvpBrdPKokx0OjzYnQIadBY","alg":"ES256","crv":"P-256","kid":"fB952Zh_53sA9a9x-ijVfnuC5EwVtP5dKqI_Turx87g","kty":"EC","use":"sig"}]},"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":true,"service_subject_id":null,"scopes":[{"id":"01a17add-fa18-7a36-b810-c7dde0a4cb18","name":"openid","assignment":"default"},{"id":"01a17add-fa1a-7c11-b09e-e6d447e51736","name":"profile","assignment":"default"},{"id":"01a17add-fa1c-7256-a9fd-18b443ffc9cf","name":"email","assignment":"default"},{"id":"01a17add-fa1e-797b-9def-b49e6f02fb5a","name":"address","assignment":"default"},{"id":"01a17add-fa1f-7852-a377-60102221d9d1","name":"phone","assignment":"default"},{"id":"01a17add-fa21-71ab-a072-2ca086745c1f","name":"roles","assignment":"default"},{"id":"01a17add-fa23-7e6f-bb35-97fbc73ef53a","name":"groups","assignment":"default"},{"id":"01a17add-fa24-7658-b13e-5aa958ece1c5","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]},{"id":"01a17ae3-e009-737b-b643-567e36fecf7f","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-27T01:05:16.783Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17ae3-dff0-7a19-a5fb-d943c0db1f0f","scopes":[{"id":"01a17add-fa18-7a36-b810-c7dde0a4cb18","name":"openid","assignment":"default"},{"id":"01a17add-fa1a-7c11-b09e-e6d447e51736","name":"profile","assignment":"default"},{"id":"01a17add-fa1c-7256-a9fd-18b443ffc9cf","name":"email","assignment":"default"},{"id":"01a17add-fa1e-797b-9def-b49e6f02fb5a","name":"address","assignment":"default"},{"id":"01a17add-fa1f-7852-a377-60102221d9d1","name":"phone","assignment":"default"},{"id":"01a17add-fa21-71ab-a072-2ca086745c1f","name":"roles","assignment":"default"},{"id":"01a17add-fa23-7e6f-bb35-97fbc73ef53a","name":"groups","assignment":"default"},{"id":"01a17add-fa24-7658-b13e-5aa958ece1c5","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}]}
```

**Search and filters** follow `GET /admin/tenants` above: a prefix of
`?client_id=` or `?name=`, never both, over the stored `client_id_search` and
`name_search` columns (`0074_list_indexes_tenants_clients.sql`), ordered by that
folded column then by `id`; exact filters `?type=public|confidential` and
`?enabled=true|false`, `AND`ed with it and with each other; a cursor bound to
every filter; any other parameter refused with `400` naming it. Whose `demo`
held `demo-backend`, `demo-exchanger`, `demo-fields-check` and `demo-operator`
(confidential) and `demo-spa` (public):

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/clients?client_id=DEMO&type=confidential&limit=1"
```

```
HTTP/1.1 200 OK
x-request-id: 01a109b6-1fbb-7ab9-a8ca-373352d5080c
cache-control: no-store
link: </admin/tenants/demo/clients?limit=1&client_id=DEMO&type=confidential&cursor=eyJhZnRlciI6IjAxYTEwOWI2LTFlMjUtNzE1NC05YTNjLTY4NmQwZTRkOTZkOCIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTA5YjYtMWQ4ZC03OGRhLTlkZjAtMGQyOGI3MmNlMmU4IiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.CQafQT0JjW7vgY0nkERqkXNzPNAFpBYEIfvi3W82pZc>; rel="next"
content-type: application/json; charset=utf-8
content-length: 2256
Date: Mon, 05 Oct 2026 01:38:13 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a109b6-1e25-7154-9a3c-686d0e4d96d8","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-27T01:05:16.783Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a109b6-1e08-73b5-b63f-7e89c1af0ad1","scopes":[{"id":"01a109b6-1d8f-7df7-a3ef-36164961fbbc","name":"openid","assignment":"default"},{"id":"01a109b6-1d90-79dd-bd97-5ff11a7bdada","name":"profile","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6243ce77a609","name":"email","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6244f8af75ca","name":"address","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e124a6313a","name":"phone","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e210286ad3","name":"roles","assignment":"default"},{"id":"01a109b6-1d93-7e58-971c-61e1c1e76586","name":"groups","assignment":"default"},{"id":"01a109b6-1d94-7b22-b794-705545e99aeb","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}],"next":"eyJhZnRlciI6IjAxYTE3YWUzLWUwMDktNzM3Yi1iNjQzLTU2N2UzNmZlY2Y3ZiIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTdhZGQtZmExMS03M2RlLWFkZDUtODIwODA2Y2VkZDc4IiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.xP7ivkUPUiBwV5IHB45ejwzXTsrwVbVvgq-a6XhKly8"}
```

Following that link, then `?name=Demo-S`, each cut down with `jq` to the
fields that show the point; then the same cursor replayed with `?type=`
dropped:

```bash
CURSOR='eyJhZnRlciI6IjAxYTEwOWI2LTFlMjUtNzE1NC05YTNjLTY4NmQwZTRkOTZkOCIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTA5YjYtMWQ4ZC03OGRhLTlkZjAtMGQyOGI3MmNlMmU4IiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.CQafQT0JjW7vgY0nkERqkXNzPNAFpBYEIfvi3W82pZc'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/clients?limit=1&client_id=DEMO&type=confidential&cursor=$CURSOR" \
  | jq -c '{items: [.items[] | {client_id, name, type}], next}'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/clients?name=Demo-S" \
  | jq -c '{items: [.items[] | {client_id, name, type}], next}'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/clients?limit=1&client_id=DEMO&cursor=$CURSOR"
```

```
{"items":[{"client_id":"demo-exchanger","name":"demo-exchanger","type":"confidential"}],"next":"eyJhZnRlciI6IjAxYTEwOWI2LTFlNjQtNzQzMi1iMmRjLTI5OTQ0NmE1Y2Y1NyIsInNvcnQiOiJkZW1vLWV4Y2hhbmdlciIsImNvbGxlY3Rpb24iOiJjbGllbnRzIiwidGVuYW50SWQiOiIwMWExMDliNi0xZDhkLTc4ZGEtOWRmMC0wZDI4YjcyY2UyZTgiLCJmaWx0ZXJzIjoiT0FkQ2hRTEk0S3lQa1QxSEtzTkRKV3lYMzg1LVhpYWxCS1JuQ1c5Q09kcyJ9.tLAAVx24BFwarLA4v_iYEmP65xZGHu03aBgjzX7-tZw"}
{"items":[{"client_id":"demo-spa","name":"demo-spa","type":"public"}],"next":null}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"cursor is invalid or expired","errors":[{"path":"cursor","message":"is invalid or expired"}],"instance":"01a109b6-b459-7bbd-8cb7-d533f4439711"}
```

A `type` outside the enum, then two search fields at once (the second refusal
names all three searches that may not be combined, `client_id_exact` among
them):

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/clients?type=service"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/demo/clients?client_id=a&name=b"
```

```
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/type must be equal to one of the allowed values","errors":[{"path":"type","message":"must be equal to one of the allowed values"}],"instance":"01a109b6-b46c-7c9b-a932-b20917d2eb43"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"search one field at a time: client_id, client_id_exact or name, not more than one","errors":[{"path":"name","message":"search one field at a time: client_id, client_id_exact or name, not more than one"}],"instance":"01a11154-0063-73bd-bbde-61a26127a013"}
```

Reading one client by its internal id carries an `ETag` and never the
secret, whether or not one was ever generated:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/clients/01a17add-fa29-747d-9960-8fe07e6a8912
```

```
HTTP/1.1 200 OK
x-request-id: 01a17ae4-dd20-7572-a26e-8792e92c068c
cache-control: no-store
etag: "721f3544b87c2a93b0160b4b51e95eb0c5107d77fd31fa39a41d1b4afba7907c"
content-type: application/json; charset=utf-8
content-length: 2256
Date: Tue, 27 Oct 2026 01:06:21 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17add-fa29-747d-9960-8fe07e6a8912","client_id":"odudu-admin","name":"Odudu administration","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"seeded","created_at":"2026-10-27T00:58:50.257Z","redirect_uris":["http://127.0.0.1:8080/callback","http://localhost:3082/console/auth/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"private_key_jwt","audiences":["urn:odudu:params:admin-api"],"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":["http://localhost:3082/console/"],"jwks":{"keys":[{"x":"DpLEax1I1XO588egrDfzu4eYq11j3MyCa2Qu8-exgag","y":"Mjaadu-NjCgQ9dA6NK0-CvpBrdPKokx0OjzYnQIadBY","alg":"ES256","crv":"P-256","kid":"fB952Zh_53sA9a9x-ijVfnuC5EwVtP5dKqI_Turx87g","kty":"EC","use":"sig"}]},"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":true,"service_subject_id":null,"scopes":[{"id":"01a109b6-1d8f-7df7-a3ef-36164961fbbc","name":"openid","assignment":"default"},{"id":"01a109b6-1d90-79dd-bd97-5ff11a7bdada","name":"profile","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6243ce77a609","name":"email","assignment":"default"},{"id":"01a109b6-1d91-74f8-b577-6244f8af75ca","name":"address","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e124a6313a","name":"phone","assignment":"default"},{"id":"01a109b6-1d92-7ef2-9bb8-58e210286ad3","name":"roles","assignment":"default"},{"id":"01a109b6-1d93-7e58-971c-61e1c1e76586","name":"groups","assignment":"default"},{"id":"01a109b6-1d94-7b22-b794-705545e99aeb","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}
```

