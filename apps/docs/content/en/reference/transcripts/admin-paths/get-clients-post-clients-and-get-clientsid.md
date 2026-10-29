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
  http://localhost:3000/admin/tenants/demo/clients
```

```
HTTP/1.1 201 Created
x-request-id: 01a1870f-4b09-70ab-aa70-8f3ee0d833ff
cache-control: no-store
etag: "c064dcbb5ca5225fafe39138988c5f5f7050d7499b7e98aa891e04bd8e9e74c0"
content-type: application/json; charset=utf-8
content-length: 2118
Date: Thu, 29 Oct 2026 09:48:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a1870f-4b2e-763d-b0da-0dffffa6ea64","client_id":"demo-fields-check","name":"demo-fields-check","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-29T09:48:08.849Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":["https://api.demo.example"],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":["https://app.demo.example"],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a1870f-4b13-7756-8fdc-470eed456014","scopes":[{"id":"01a1870f-49a9-7b18-8d43-43317ef5cebc","name":"openid","assignment":"default"},{"id":"01a1870f-49ab-7f74-be08-d377dfac7bba","name":"profile","assignment":"default"},{"id":"01a1870f-49ac-704d-924f-6c53ed1a92f3","name":"email","assignment":"default"},{"id":"01a1870f-49ad-7dd3-a582-b4729cbe66e5","name":"address","assignment":"default"},{"id":"01a1870f-49ae-78b8-8b90-b25e012b6562","name":"phone","assignment":"default"},{"id":"01a1870f-49af-76a0-8af6-4abcd45c8848","name":"roles","assignment":"default"},{"id":"01a1870f-49b0-74d4-a3e2-3cb8653a7921","name":"groups","assignment":"default"},{"id":"01a1870f-49b2-761c-8b9f-ff0cf588f042","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"9nMuwzu79hDa9V05oRsHZCbqygVqJJNYlUwGhCDpc0U"}
```

`GET`ting it back shows both fields still set, from the row rather than the
create response — and now also carries `builtin_admin` and
`service_subject_id`, read from the same row a create response is:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/clients/$FID
```

```
HTTP/1.1 200 OK
x-request-id: 01a1870f-4b76-7b61-907e-a2cc9fa4eea1
cache-control: no-store
etag: "c064dcbb5ca5225fafe39138988c5f5f7050d7499b7e98aa891e04bd8e9e74c0"
content-type: application/json; charset=utf-8
content-length: 2083
Date: Thu, 29 Oct 2026 09:48:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a1870f-4b2e-763d-b0da-0dffffa6ea64","client_id":"demo-fields-check","name":"demo-fields-check","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-29T09:48:08.849Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":["https://api.demo.example"],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":["https://app.demo.example"],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a1870f-4b13-7756-8fdc-470eed456014","scopes":[{"id":"01a1870f-49a9-7b18-8d43-43317ef5cebc","name":"openid","assignment":"default"},{"id":"01a1870f-49ab-7f74-be08-d377dfac7bba","name":"profile","assignment":"default"},{"id":"01a1870f-49ac-704d-924f-6c53ed1a92f3","name":"email","assignment":"default"},{"id":"01a1870f-49ad-7dd3-a582-b4729cbe66e5","name":"address","assignment":"default"},{"id":"01a1870f-49ae-78b8-8b90-b25e012b6562","name":"phone","assignment":"default"},{"id":"01a1870f-49af-76a0-8af6-4abcd45c8848","name":"roles","assignment":"default"},{"id":"01a1870f-49b0-74d4-a3e2-3cb8653a7921","name":"groups","assignment":"default"},{"id":"01a1870f-49b2-761c-8b9f-ff0cf588f042","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"supported_locales":["en"]}
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
from another, and say so where they appear. The create answers `201`, the whole
client, the tenant's default scope assignments, and the one-time secret. The
`scopes` ids are `client-facts-demo`'s own, created with the tenant:

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "demo-backend", "grant_types": ["client_credentials"], "token_endpoint_auth_method": "client_secret_basic"}' \
  http://localhost:3000/admin/tenants/client-facts-demo/clients
```

```
HTTP/1.1 201 Created
x-request-id: 01a1870f-4be5-77ff-8b38-98f408549587
cache-control: no-store
etag: "dde0c2a98627fe1d43de78ef52bda4c96f4d5c8e2000aceb6197d694145e178a"
content-type: application/json; charset=utf-8
content-length: 2056
Date: Thu, 29 Oct 2026 09:48:09 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a1870f-4c08-71a9-bc26-e8ff451945b9","client_id":"demo-backend","name":"demo-backend","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-29T09:48:09.069Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a1870f-4bee-75da-8087-3ce7f7fdb5f9","scopes":[{"id":"01a1870f-4bb4-7f53-88cc-0e8e22c3b7dd","name":"openid","assignment":"default"},{"id":"01a1870f-4bb5-70fe-b2c1-2d1fbc748cea","name":"profile","assignment":"default"},{"id":"01a1870f-4bb7-7268-8c96-511d23ae0560","name":"email","assignment":"default"},{"id":"01a1870f-4bb8-7781-a1b3-44627f4f59c5","name":"address","assignment":"default"},{"id":"01a1870f-4bb9-7526-9ffc-f0a40a302c45","name":"phone","assignment":"default"},{"id":"01a1870f-4bbb-7763-9301-f524199beb49","name":"roles","assignment":"default"},{"id":"01a1870f-4bbc-7983-a2bc-aab1a0e58d90","name":"groups","assignment":"default"},{"id":"01a1870f-4bbd-72df-81c2-9d78899e23be","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"fhunvUdsDFZUOfwlW_TovLBqsDVI_ffcCWO0GF0W5VM"}
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
  http://localhost:3000/admin/tenants/client-facts-demo/clients?limit=50
```

```
{"items":[{"id":"01a1870f-4bbf-7e66-8fda-5b19d0c28428","client_id":"odudu-admin","name":"Odudu administration","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":true,"registration_origin":"seeded","created_at":"2026-10-29T09:48:09.010Z","redirect_uris":["http://127.0.0.1:8080/callback","http://localhost:3000/console/auth/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"private_key_jwt","audiences":["urn:odudu:params:admin-api"],"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":["http://localhost:3000/console/"],"jwks":{"keys":[{"x":"aGq8ehE1zvB68TgqZayK_lkYRNm0vA6h952baJXQc8U","y":"oQ9TfiTytJOTeGH_4qdFyVQuZmlfg5GW_7ZokhBYvWg","alg":"ES256","crv":"P-256","kid":"ryDJgLR1j3NaIONgY2PD1W3iDMdkhNlsu0lel927CAs","kty":"EC","use":"sig"}]},"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":true,"service_subject_id":null,"scopes":[{"id":"01a1870f-4bb4-7f53-88cc-0e8e22c3b7dd","name":"openid","assignment":"default"},{"id":"01a1870f-4bb5-70fe-b2c1-2d1fbc748cea","name":"profile","assignment":"default"},{"id":"01a1870f-4bb7-7268-8c96-511d23ae0560","name":"email","assignment":"default"},{"id":"01a1870f-4bb8-7781-a1b3-44627f4f59c5","name":"address","assignment":"default"},{"id":"01a1870f-4bb9-7526-9ffc-f0a40a302c45","name":"phone","assignment":"default"},{"id":"01a1870f-4bbb-7763-9301-f524199beb49","name":"roles","assignment":"default"},{"id":"01a1870f-4bbc-7983-a2bc-aab1a0e58d90","name":"groups","assignment":"default"},{"id":"01a1870f-4bbd-72df-81c2-9d78899e23be","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]},{"id":"01a1870f-4c08-71a9-bc26-e8ff451945b9","client_id":"demo-backend","name":"demo-backend","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-29T09:48:09.069Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a1870f-4bee-75da-8087-3ce7f7fdb5f9","scopes":[{"id":"01a1870f-4bb4-7f53-88cc-0e8e22c3b7dd","name":"openid","assignment":"default"},{"id":"01a1870f-4bb5-70fe-b2c1-2d1fbc748cea","name":"profile","assignment":"default"},{"id":"01a1870f-4bb7-7268-8c96-511d23ae0560","name":"email","assignment":"default"},{"id":"01a1870f-4bb8-7781-a1b3-44627f4f59c5","name":"address","assignment":"default"},{"id":"01a1870f-4bb9-7526-9ffc-f0a40a302c45","name":"phone","assignment":"default"},{"id":"01a1870f-4bbb-7763-9301-f524199beb49","name":"roles","assignment":"default"},{"id":"01a1870f-4bbc-7983-a2bc-aab1a0e58d90","name":"groups","assignment":"default"},{"id":"01a1870f-4bbd-72df-81c2-9d78899e23be","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}]}
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
  "http://localhost:3000/admin/tenants/demo/clients?client_id=DEMO&type=confidential&limit=1"
```

```
HTTP/1.1 200 OK
x-request-id: 01a1870f-4c5f-7da6-8cec-6a4eb3531a61
cache-control: no-store
link: </admin/tenants/demo/clients?limit=1&client_id=DEMO&type=confidential&cursor=eyJhZnRlciI6IjAxYTE4NzBmLTRhMGEtNzg2Zi05NDg2LTQyYmU3NzAwYTNhNSIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTg3MGYtNDlhNi03MmIxLWFiM2EtODE1OTM4MGMwODBhIiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.kxwi54LyToAPVBE1bN9HRJJrPHcmAUKmzB2FCdWYtT0>; rel="next"
content-type: application/json; charset=utf-8
content-length: 2326
Date: Thu, 29 Oct 2026 09:48:09 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a1870f-4a0a-786f-9486-42be7700a3a5","client_id":"demo-backend","name":"demo-backend","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-29T09:48:08.557Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a1870f-49ee-7275-9775-657f21be909b","scopes":[{"id":"01a1870f-49a9-7b18-8d43-43317ef5cebc","name":"openid","assignment":"default"},{"id":"01a1870f-49ab-7f74-be08-d377dfac7bba","name":"profile","assignment":"default"},{"id":"01a1870f-49ac-704d-924f-6c53ed1a92f3","name":"email","assignment":"default"},{"id":"01a1870f-49ad-7dd3-a582-b4729cbe66e5","name":"address","assignment":"default"},{"id":"01a1870f-49ae-78b8-8b90-b25e012b6562","name":"phone","assignment":"default"},{"id":"01a1870f-49af-76a0-8af6-4abcd45c8848","name":"roles","assignment":"default"},{"id":"01a1870f-49b0-74d4-a3e2-3cb8653a7921","name":"groups","assignment":"default"},{"id":"01a1870f-49b2-761c-8b9f-ff0cf588f042","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}],"next":"eyJhZnRlciI6IjAxYTE4NzBmLTRhMGEtNzg2Zi05NDg2LTQyYmU3NzAwYTNhNSIsInNvcnQiOiJkZW1vLWJhY2tlbmQiLCJjb2xsZWN0aW9uIjoiY2xpZW50cyIsInRlbmFudElkIjoiMDFhMTg3MGYtNDlhNi03MmIxLWFiM2EtODE1OTM4MGMwODBhIiwiZmlsdGVycyI6Ik9BZENoUUxJNEt5UGtUMUhLc05ESld5WDM4NS1YaWFsQktSbkNXOUNPZHMifQ.kxwi54LyToAPVBE1bN9HRJJrPHcmAUKmzB2FCdWYtT0"}
```

Following that link (`$CURSOR` is the `cursor` in its `link` header), then
`?name=Demo-S`, each cut down with `jq` to the fields that show the point; then
the same cursor replayed with `?type=` dropped:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/demo/clients?limit=1&client_id=DEMO&type=confidential&cursor=$CURSOR" \
  | jq -c '{items: [.items[] | {client_id, name, type}], next}'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/demo/clients?name=Demo-S" \
  | jq -c '{items: [.items[] | {client_id, name, type}], next}'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/demo/clients?limit=1&client_id=DEMO&cursor=$CURSOR"
```

```
{"items":[{"client_id":"demo-exchanger","name":"demo-exchanger","type":"confidential"}],"next":"eyJhZnRlciI6IjAxYTE4NzBmLTRhNTAtNzRlMi05Yzk3LTAwYjg0MTAwMTUyZCIsInNvcnQiOiJkZW1vLWV4Y2hhbmdlciIsImNvbGxlY3Rpb24iOiJjbGllbnRzIiwidGVuYW50SWQiOiIwMWExODcwZi00OWE2LTcyYjEtYWIzYS04MTU5MzgwYzA4MGEiLCJmaWx0ZXJzIjoiT0FkQ2hRTEk0S3lQa1QxSEtzTkRKV3lYMzg1LVhpYWxCS1JuQ1c5Q09kcyJ9.vCBMILeZfx7IzVl-vS7TP3O0yDSfPU5kBcDZdEJvFJY"}
{"items":[{"client_id":"demo-spa","name":"demo-spa","type":"public"}],"next":null}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"cursor is invalid or expired","errors":[{"path":"cursor","message":"is invalid or expired"}],"instance":"01a1870f-4cda-7361-80ee-b21cbba60611"}
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
  http://localhost:3000/admin/tenants/demo/clients/$AID
```

```
HTTP/1.1 200 OK
x-request-id: 01a1870f-4cff-7b62-b226-04500e0dd41b
cache-control: no-store
etag: "18c6b10442099bde6ae6c27bfa03d65c6944e216f7a01bdfe46c55bc1ae0c570"
content-type: application/json; charset=utf-8
content-length: 2352
Date: Thu, 29 Oct 2026 09:48:09 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a1870f-49b4-7f69-9ea1-cc2c0bfb04e4","client_id":"odudu-admin","name":"Odudu administration","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":true,"registration_origin":"seeded","created_at":"2026-10-29T09:48:08.487Z","redirect_uris":["http://127.0.0.1:8080/callback","http://localhost:3000/console/auth/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"private_key_jwt","audiences":["urn:odudu:params:admin-api"],"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":["http://localhost:3000/console/"],"jwks":{"keys":[{"x":"aGq8ehE1zvB68TgqZayK_lkYRNm0vA6h952baJXQc8U","y":"oQ9TfiTytJOTeGH_4qdFyVQuZmlfg5GW_7ZokhBYvWg","alg":"ES256","crv":"P-256","kid":"ryDJgLR1j3NaIONgY2PD1W3iDMdkhNlsu0lel927CAs","kty":"EC","use":"sig"}]},"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":true,"service_subject_id":null,"scopes":[{"id":"01a1870f-49a9-7b18-8d43-43317ef5cebc","name":"openid","assignment":"default"},{"id":"01a1870f-49ab-7f74-be08-d377dfac7bba","name":"profile","assignment":"default"},{"id":"01a1870f-49ac-704d-924f-6c53ed1a92f3","name":"email","assignment":"default"},{"id":"01a1870f-49ad-7dd3-a582-b4729cbe66e5","name":"address","assignment":"default"},{"id":"01a1870f-49ae-78b8-8b90-b25e012b6562","name":"phone","assignment":"default"},{"id":"01a1870f-49af-76a0-8af6-4abcd45c8848","name":"roles","assignment":"default"},{"id":"01a1870f-49b0-74d4-a3e2-3cb8653a7921","name":"groups","assignment":"default"},{"id":"01a1870f-49b2-761c-8b9f-ff0cf588f042","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"supported_locales":["en"]}
```
