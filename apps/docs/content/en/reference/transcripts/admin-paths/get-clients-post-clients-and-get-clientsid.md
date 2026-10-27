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
x-request-id: 01a17d30-f557-7683-aa91-dfe1990405ae
cache-control: no-store
etag: "747fee312e03aa8a6e50e2b954402e7cf617422a35d4bc8f76f99467a7e6a964"
content-type: application/json; charset=utf-8
content-length: 2081
Date: Tue, 27 Oct 2026 11:48:43 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17d30-f5a0-7d73-979e-059aafcb282c","client_id":"demo-fields-check","name":"demo-fields-check","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:48:42.976Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":["https://api.demo.example"],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":["https://app.demo.example"],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d30-f561-7dcd-b5a7-4d82d816b655","scopes":[{"id":"01a17d30-9d74-7bcb-8ffd-607181716855","name":"openid","assignment":"default"},{"id":"01a17d30-9d75-74fa-89e3-c3f4fb9d7e11","name":"profile","assignment":"default"},{"id":"01a17d30-9d77-7f5d-8998-fd2924cecbae","name":"email","assignment":"default"},{"id":"01a17d30-9d78-75c7-a014-aacd0f71e011","name":"address","assignment":"default"},{"id":"01a17d30-9d7a-7afa-8ccc-af48085cba39","name":"phone","assignment":"default"},{"id":"01a17d30-9d7b-7171-8e74-9685376448f0","name":"roles","assignment":"default"},{"id":"01a17d30-9d7d-7126-acc9-adfeccaadcb9","name":"groups","assignment":"default"},{"id":"01a17d30-9d7e-7c84-b318-8606637e19ce","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"zUMxi1Y0ztxY_PuLqUkXLjlasmfHUYGiUB_TE5WvGqk"}
```

`GET`ting it back shows both fields still set, from the row rather than the
create response — and now also carries `builtin_admin` and
`service_subject_id`, read from the same row a create response is:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/demo/clients/01a17d30-f5a0-7d73-979e-059aafcb282c
```

```
HTTP/1.1 200 OK
x-request-id: 01a17d30-f63d-73e2-af1f-07d844d01876
cache-control: no-store
etag: "747fee312e03aa8a6e50e2b954402e7cf617422a35d4bc8f76f99467a7e6a964"
content-type: application/json; charset=utf-8
content-length: 2019
Date: Tue, 27 Oct 2026 11:48:43 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17d30-f5a0-7d73-979e-059aafcb282c","client_id":"demo-fields-check","name":"demo-fields-check","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:48:42.976Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":["https://api.demo.example"],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":["https://app.demo.example"],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d30-f561-7dcd-b5a7-4d82d816b655","scopes":[{"id":"01a17d30-9d74-7bcb-8ffd-607181716855","name":"openid","assignment":"default"},{"id":"01a17d30-9d75-74fa-89e3-c3f4fb9d7e11","name":"profile","assignment":"default"},{"id":"01a17d30-9d77-7f5d-8998-fd2924cecbae","name":"email","assignment":"default"},{"id":"01a17d30-9d78-75c7-a014-aacd0f71e011","name":"address","assignment":"default"},{"id":"01a17d30-9d7a-7afa-8ccc-af48085cba39","name":"phone","assignment":"default"},{"id":"01a17d30-9d7b-7171-8e74-9685376448f0","name":"roles","assignment":"default"},{"id":"01a17d30-9d7d-7126-acc9-adfeccaadcb9","name":"groups","assignment":"default"},{"id":"01a17d30-9d7e-7c84-b318-8606637e19ce","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}
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
x-request-id: 01a17d30-f684-7dfe-8b10-c833d3deda9e
cache-control: no-store
etag: "ad9ea3ab1276bd88bb5d050c4e79f255e96153b91ce51454ef9ef0c4605d0d6c"
content-type: application/json; charset=utf-8
content-length: 2019
Date: Tue, 27 Oct 2026 11:48:43 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17d30-f6bf-7f10-b111-f613b93105fb","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:48:43.287Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d30-f699-79b5-b8eb-264c767951f2","scopes":[{"id":"01a17d30-9dc4-71ad-9969-bb32fb3553f5","name":"openid","assignment":"default"},{"id":"01a17d30-9dc6-7064-9cd5-efdb8efceac3","name":"profile","assignment":"default"},{"id":"01a17d30-9dc7-7f33-9c63-df1bcfcb3a93","name":"email","assignment":"default"},{"id":"01a17d30-9dc9-7b65-907c-edf2cbb4d8f9","name":"address","assignment":"default"},{"id":"01a17d30-9dca-7bfe-bbd4-499683f46766","name":"phone","assignment":"default"},{"id":"01a17d30-9dcc-792c-97ce-9ceb98881273","name":"roles","assignment":"default"},{"id":"01a17d30-9dcd-7d5d-8406-2953bbfc060b","name":"groups","assignment":"default"},{"id":"01a17d30-9dce-725d-82b3-d9f031b0d9c2","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"TDXIBbG5pw8S0NtEEf7_KFiatzjWHnIQ9YyPhT2a3jY"}
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
{"items":[{"id":"01a17d30-9d81-72de-ac11-975f0a504d39","client_id":"odudu-admin","name":"Odudu administration","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":true,"registration_origin":"seeded","created_at":"2026-10-27T11:48:20.464Z","redirect_uris":["http://127.0.0.1:8080/callback","http://localhost:3194/console/auth/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"private_key_jwt","audiences":["urn:odudu:params:admin-api"],"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":["http://localhost:3194/console/"],"jwks":{"keys":[{"x":"r3y1WxvGoTuqW65jRhE6D3Tdt-pUrR1Vb6YLCSA-BpY","y":"izqiTlNSTYoHg-TA7rXAmVYyW-v5zuK8S98K8oekLrU","alg":"ES256","crv":"P-256","kid":"B5FFaeoY8pdJr3O2uWmpJGhml_GYya_Rs76ltUqKwWc","kty":"EC","use":"sig"}]},"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":true,"service_subject_id":null,"scopes":[{"id":"01a17d30-9d74-7bcb-8ffd-607181716855","name":"openid","assignment":"default"},{"id":"01a17d30-9d75-74fa-89e3-c3f4fb9d7e11","name":"profile","assignment":"default"},{"id":"01a17d30-9d77-7f5d-8998-fd2924cecbae","name":"email","assignment":"default"},{"id":"01a17d30-9d78-75c7-a014-aacd0f71e011","name":"address","assignment":"default"},{"id":"01a17d30-9d7a-7afa-8ccc-af48085cba39","name":"phone","assignment":"default"},{"id":"01a17d30-9d7b-7171-8e74-9685376448f0","name":"roles","assignment":"default"},{"id":"01a17d30-9d7d-7126-acc9-adfeccaadcb9","name":"groups","assignment":"default"},{"id":"01a17d30-9d7e-7c84-b318-8606637e19ce","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]},{"id":"01a17d30-f44f-7d25-b1c0-b0401d0c03cd","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:48:42.636Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d30-f410-76b6-8ad0-85a113949c01","scopes":[{"id":"01a17d30-9d74-7bcb-8ffd-607181716855","name":"openid","assignment":"default"},{"id":"01a17d30-9d75-74fa-89e3-c3f4fb9d7e11","name":"profile","assignment":"default"},{"id":"01a17d30-9d77-7f5d-8998-fd2924cecbae","name":"email","assignment":"default"},{"id":"01a17d30-9d78-75c7-a014-aacd0f71e011","name":"address","assignment":"default"},{"id":"01a17d30-9d7a-7afa-8ccc-af48085cba39","name":"phone","assignment":"default"},{"id":"01a17d30-9d7b-7171-8e74-9685376448f0","name":"roles","assignment":"default"},{"id":"01a17d30-9d7d-7126-acc9-adfeccaadcb9","name":"groups","assignment":"default"},{"id":"01a17d30-9d7e-7c84-b318-8606637e19ce","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}]}
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
x-request-id: 01a17d31-1734-7a9b-8b9e-fc4fbaf4cf38
cache-control: no-store
link: </admin/tenants/demo/clients?limit=1&client_id=DEMO&type=confidential&cursor=eyJhZnRlciI6IjAxYTE3ZDMwLWY0NGYtN2QyNS1iMWMwLWIwNDAxZDBjMDNjZCIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTdkMzAtOWQ3MC03NzQ1LThiY2EtY2FmM2M1ZGNjYWRiIiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.htd8qlwp_uSCeZ3wfgHBwuTIAAyVKCsiJ5v3pbMqUDY>; rel="next"
content-type: application/json; charset=utf-8
content-length: 2289
Date: Tue, 27 Oct 2026 11:48:51 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a17d30-f44f-7d25-b1c0-b0401d0c03cd","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:48:42.636Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d30-f410-76b6-8ad0-85a113949c01","scopes":[{"id":"01a17d30-9d74-7bcb-8ffd-607181716855","name":"openid","assignment":"default"},{"id":"01a17d30-9d75-74fa-89e3-c3f4fb9d7e11","name":"profile","assignment":"default"},{"id":"01a17d30-9d77-7f5d-8998-fd2924cecbae","name":"email","assignment":"default"},{"id":"01a17d30-9d78-75c7-a014-aacd0f71e011","name":"address","assignment":"default"},{"id":"01a17d30-9d7a-7afa-8ccc-af48085cba39","name":"phone","assignment":"default"},{"id":"01a17d30-9d7b-7171-8e74-9685376448f0","name":"roles","assignment":"default"},{"id":"01a17d30-9d7d-7126-acc9-adfeccaadcb9","name":"groups","assignment":"default"},{"id":"01a17d30-9d7e-7c84-b318-8606637e19ce","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}],"next":"eyJhZnRlciI6IjAxYTE3ZDMwLWY0NGYtN2QyNS1iMWMwLWIwNDAxZDBjMDNjZCIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTdkMzAtOWQ3MC03NzQ1LThiY2EtY2FmM2M1ZGNjYWRiIiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.htd8qlwp_uSCeZ3wfgHBwuTIAAyVKCsiJ5v3pbMqUDY"}
```

Following that link, then `?name=Demo-S`, each cut down with `jq` to the
fields that show the point; then the same cursor replayed with `?type=`
dropped:

```bash
CURSOR='eyJhZnRlciI6IjAxYTE3ZDMwLWY0NGYtN2QyNS1iMWMwLWIwNDAxZDBjMDNjZCIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTdkMzAtOWQ3MC03NzQ1LThiY2EtY2FmM2M1ZGNjYWRiIiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.htd8qlwp_uSCeZ3wfgHBwuTIAAyVKCsiJ5v3pbMqUDY'
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
{"items":[{"client_id":"demo-exchanger","name":"demo-exchanger","type":"confidential"}],"next":"eyJhZnRlciI6IjAxYTE3ZDMwLWY0YmUtNzBmZS04OTVlLTllMTZjYWFiOWMxYyIsInNvcnQiOiJkZW1vLWV4Y2hhbmdlciIsImNvbGxlY3Rpb24iOiJjbGllbnRzIiwidGVuYW50SWQiOiIwMWExN2QzMC05ZDcwLTc3NDUtOGJjYS1jYWYzYzVkY2NhZGIiLCJmaWx0ZXJzIjoiT0FkQ2hRTEk0S3lQa1QxSEtzTkRKV3lYMzg1LVhpYWxCS1JuQ1c5Q09kcyJ9.V_G5EwP8v09rph_gXYHowuYXUK706NzqkErY258O2no"}
{"items":[{"client_id":"demo-spa","name":"demo-spa","type":"public"}],"next":null}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"cursor is invalid or expired","errors":[{"path":"cursor","message":"is invalid or expired"}],"instance":"01a17d31-178f-7961-b109-fdd80d2319be"}
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
  http://localhost:3000/admin/tenants/demo/clients/01a17d30-9d81-72de-ac11-975f0a504d39
```

```
HTTP/1.1 200 OK
x-request-id: 01a17d31-17ad-79df-89e4-69e0a326dad0
cache-control: no-store
etag: "583c7ee6a1f765962287bb4df7eae1f830b70ac710ae49091ff2b6e187a25da2"
content-type: application/json; charset=utf-8
content-length: 2288
Date: Tue, 27 Oct 2026 11:48:51 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17d30-9d81-72de-ac11-975f0a504d39","client_id":"odudu-admin","name":"Odudu administration","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":true,"registration_origin":"seeded","created_at":"2026-10-27T11:48:20.464Z","redirect_uris":["http://127.0.0.1:8080/callback","http://localhost:3194/console/auth/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"private_key_jwt","audiences":["urn:odudu:params:admin-api"],"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":["http://localhost:3194/console/"],"jwks":{"keys":[{"x":"r3y1WxvGoTuqW65jRhE6D3Tdt-pUrR1Vb6YLCSA-BpY","y":"izqiTlNSTYoHg-TA7rXAmVYyW-v5zuK8S98K8oekLrU","alg":"ES256","crv":"P-256","kid":"B5FFaeoY8pdJr3O2uWmpJGhml_GYya_Rs76ltUqKwWc","kty":"EC","use":"sig"}]},"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":true,"service_subject_id":null,"scopes":[{"id":"01a17d30-9d74-7bcb-8ffd-607181716855","name":"openid","assignment":"default"},{"id":"01a17d30-9d75-74fa-89e3-c3f4fb9d7e11","name":"profile","assignment":"default"},{"id":"01a17d30-9d77-7f5d-8998-fd2924cecbae","name":"email","assignment":"default"},{"id":"01a17d30-9d78-75c7-a014-aacd0f71e011","name":"address","assignment":"default"},{"id":"01a17d30-9d7a-7afa-8ccc-af48085cba39","name":"phone","assignment":"default"},{"id":"01a17d30-9d7b-7171-8e74-9685376448f0","name":"roles","assignment":"default"},{"id":"01a17d30-9d7d-7126-acc9-adfeccaadcb9","name":"groups","assignment":"default"},{"id":"01a17d30-9d7e-7c84-b318-8606637e19ce","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}
```
