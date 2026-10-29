---
title: 'PATCH /clients/{id}'
description: 'Requires manage-clients, as every client route does.'
---

# `PATCH /clients/{id}`

> The response below predates the `supported_locales` field of a client's own read and amendment (the tenant's languages, at most 32), which the documentation close re-runs along with the rest of this page.

Requires `manage-clients`, as every client route does. Amends the fields a
general-purpose amendment can safely touch — every column of `clients` and
`client_oidc_config` except identity (`id`, `client_id`, `tenant_id`), history
(`created_at`), provenance (`registration_origin`), the security-model switch
(`type`), the secret (rotated only through `POST /secret` below) and
`builtin_admin` itself. A field this excludes is refused with `400`, naming the
field and the reason (`refusalFor`) — `client_id` answers "identity: changing it
breaks every relying party and orphans the azp of every issued token", for
instance, not merely "refused".

A list field — `redirect_uris`, `post_logout_redirect_uris`, `web_origins`,
`audiences`, `grant_types`, `client_credentials_scopes` — is replaced
**wholesale**, never appended to: the body names the complete list the
field should hold afterward. Because last-write-wins on one of these
silently reinstates exactly what another admin just removed, `If-Match` is
**required** when a request touches any of the six, answered with
`428 Precondition Required` when it is missing or is `*`, which names no
version;
every other field amends with `If-Match` optional, the same concurrency
control `PATCH /settings` uses, row lock included. A stale `If-Match` is
`412` either way, and nothing is changed.

A list field holds at most 200 entries (`CLIENT_LIST_LIMIT`,
`@odudu/contracts`), for `redirect_uris`, `web_origins`,
`post_logout_redirect_uris`, `audiences` and `client_credentials_scopes`
alike, on a create, a `PATCH`, dynamic registration, an import and `odudu seed
client`. A client is read and listed whole, and each redirect URI and web
origin is expanded into `client_origins` rows when it is written, so this is
what keeps both small. A longer list is refused with `400` naming the field,
how many entries it held and how many it may, and nothing is changed; a list
of exactly 200 is accepted. A web origin that is not a bare origin, and a
redirect URI the registration validator refuses, are refused with the entry
named, in the same `errors` shape. In the tenant `client-limits-demo`, `$P` is
`http://localhost:3000/admin/tenants/client-limits-demo`, `$ID` the client
`billing` and `$LID` the client `legacy`. Each call sent the `ETag` the `GET`
before it answered; `over-origins.json` held 201 origins `https://o0.example` to
`https://o200.example`, and `over-uris.json` 201 redirect URIs
`https://billing.example/cb/0` to `…/cb/200`:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -H "If-Match: $ETAG" \
  -d @over-origins.json $P/clients/$ID
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -H "If-Match: $ETAG" \
  -d @over-uris.json $P/clients/$ID
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -H "If-Match: $ETAG" \
  -d '{"web_origins":["https://app.example/"]}' $P/clients/$ID
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -H "If-Match: $ETAG" \
  -d '{"redirect_uris":["http://billing.example/cb"]}' $P/clients/$ID
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"web_origins: holds 201 entries, at most 200","errors":[{"path":"web_origins","message":"holds 201 entries, at most 200"}],"instance":"01a11113-f50c-7ae6-aec4-a811e51b624a"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"redirect_uris holds 201 entries, at most 200","errors":[{"path":"redirect_uris","message":"redirect_uris holds 201 entries, at most 200"}],"instance":"01a11113-f533-7a77-8896-435d4b50b8cb"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"web_origins: web_origins entry \"https://app.example/\" is not an origin: expected a scheme and host with no path, or \"+\" for every registered redirect URI's origin","errors":[{"path":"web_origins","message":"web_origins entry \"https://app.example/\" is not an origin: expected a scheme and host with no path, or \"+\" for every registered redirect URI's origin"}],"instance":"01a11113-f554-71d2-bcab-023d2110dd2b"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"redirect_uris entry http://billing.example/cb is not valid","errors":[{"path":"redirect_uris","message":"redirect_uris entry http://billing.example/cb is not valid"}],"instance":"01a11113-f571-7ff2-9da2-30785005fbfc"}
```

The same call with 200 origins, `at-origins.json`, answered `200`, and
`.web_origins | length` of the client it returned was `200`.

A create is refused the same way. `create-over-uris.json` named a public client
`too-many` with 201 redirect URIs, and `create-over-origins.json` one redirect
URI and 201 web origins; no client was made by either:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d @create-over-uris.json $P/clients
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d @create-over-origins.json $P/clients
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"redirect_uris holds 201 entries, at most 200","errors":[{"path":"redirect_uris","message":"redirect_uris holds 201 entries, at most 200"}],"instance":"01a11113-ba82-7f0c-93e2-d62bfee7a71c"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"web_origins: holds 201 entries, at most 200","errors":[{"path":"web_origins","message":"holds 201 entries, at most 200"}],"instance":"01a11113-ba98-7ea8-b109-d8ada7c90e77"}
```

**A client stored over the limit** — registered before it existed — is not
refused for what a write does not change. `legacy` was made through `POST
/clients`, and its `redirect_uris` then set to 201 entries with `psql`, which no
route does:

```bash
docker compose -p odudu-tx exec -T postgres psql -U odudu -d odudu -tA -c \
  "update client_oidc_config set redirect_uris = (select array_agg('https://legacy.example/cb/' || g) from generate_series(0, 200) g) where client_id = '$LID'"
ETAG=$(curl -sS -D - -o /dev/null -H "Authorization: Bearer $ADMIN_TOKEN" $P/clients/$LID | tr -d '\r' | sed -n 's/^etag: //p')
curl -sS -o /dev/null -w '%{http_code}\n' -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -H "If-Match: $ETAG" \
  -d '{"client_uri":"https://legacy.example/about"}' $P/clients/$LID
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -H "If-Match: $ETAG" \
  -d @patch-over.json $P/clients/$LID
```

```
UPDATE 1
200
{"type":"about:blank","title":"Bad Request","status":400,"detail":"redirect_uris holds 201 entries, at most 200","errors":[{"path":"redirect_uris","message":"redirect_uris holds 201 entries, at most 200"}],"instance":"01a11113-bbfc-7e13-bb8d-1c5284aa1858"}
```

The `PATCH` that left `redirect_uris` alone was `200`; one that sends a list
sends one under the limit or is refused (`patch-over.json` held 201 URIs). The
export carries the stored list as it is, and importing that document is
refused at the field, with its count and the limit, until it is trimmed:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" $P/export > export.json
jq -c '[.clients[] | {client_id, redirect_uris: (.redirect_uris | length)}]' export.json
jq '{name: "client-reimport-demo", document: .}' export.json > import.json
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d @import.json \
  http://localhost:3082/admin/tenant-imports
```

```
[{"client_id":"billing","redirect_uris":1},{"client_id":"legacy","redirect_uris":201}]
{"type":"about:blank","title":"Bad Request","status":400,"detail":"the import was refused for 1 problem(s), listed under errors","errors":[{"path":"document.clients[1].redirect_uris","message":"holds 201 entries, at most 200"}],"instance":"01a11113-bc50-707b-b6d5-0ea661576540"}
```

`odudu seed client` refuses a list over the limit in the same words, before it
writes anything; given 201 `--redirect-uri` flags it ends with:

```bash
docker compose exec -T odudu node dist/main.js seed client --tenant client-limits-demo \
  --client-id too-many --public \
  $(for i in $(seq 0 200); do printf -- '--redirect-uri https://billing.example/cb/%s ' $i; done) 2>&1 \
  | grep '^OduduError'
```

```
OduduError: redirect_uris holds 201 entries, at most 200
```

**A client answers what its service account holds.** `service_account_admin_reach`
is the admin capabilities the client's service account holds, in the
vocabulary's order, which every write on the client is judged against (the
target ceiling): derived on every read, one query for a whole page, and outside
the `ETag`, which is taken over the stored fields alone, as a group's
`admin_reach` is outside its own. It is empty for a client with no service
account. A caller needs no `view-users` to read it, so a console can judge the
ceiling from the record. `billing`'s service account was then given
`manage-users`, which nests `view-users`, with `psql` (no route assigns a role
to a service account):

```bash
curl -sS -D - -o body.json -H "Authorization: Bearer $ADMIN_TOKEN" $P/clients/$ID | grep -i '^etag'
jq -c '{client_id, service_account_admin_reach}' body.json
docker compose -p odudu-tx exec -T postgres psql -U odudu -d odudu -tA -c \
  "insert into subject_roles (tenant_id, subject_id, role_id) select c.tenant_id, c.service_subject_id, r.id from clients c join clients a on a.tenant_id = c.tenant_id and a.client_id = 'odudu-admin' join roles r on r.client_id = a.id and r.name = 'manage-users' where c.id = '$ID'"
curl -sS -D - -o body.json -H "Authorization: Bearer $ADMIN_TOKEN" $P/clients/$ID | grep -i '^etag'
jq -c '{client_id, service_account_admin_reach}' body.json
```

```
etag: "92cb2109800a50799741d1bde585405d61d78ffdeac1f41b4147fd4367bc7f41"
{"client_id":"billing","service_account_admin_reach":[]}
INSERT 0 1
etag: "92cb2109800a50799741d1bde585405d61d78ffdeac1f41b4147fd4367bc7f41"
{"client_id":"billing","service_account_admin_reach":["view-users","manage-users"]}
```

The `ETag` did not move. `GET /clients?client_id_exact=` finds the one client
whose `client_id` is exactly the value, case kept, through the unique index; a
prefix finds none, and it is one of the three searches that may not be
combined:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/clients?client_id_exact=billing" | jq -c '[.items[] | {client_id, service_account_admin_reach}]'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/clients?client_id_exact=bill"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/clients?client_id_exact=billing&name=b"
```

```
[{"client_id":"billing","service_account_admin_reach":["view-users","manage-users"]}]
{"items":[]}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"search one field at a time: client_id, client_id_exact or name, not more than one","errors":[{"path":"name","message":"search one field at a time: client_id, client_id_exact or name, not more than one"}],"instance":"01a11153-d113-793f-9af7-112ce85082ff"}
```

The RFC 7591 metadata fields among them — `redirect_uris`, `grant_types`,
`token_endpoint_auth_method`, `jwks`, `jwks_uri`, the two logout URIs and
their `_session_required` flags, the three `userinfo_*` response fields,
`tls_client_auth_subject_dn`, `client_uri`, `policy_uri` and `tos_uri`
— each of those three an absolute https URI, or http on a loopback
host, with no fragment, and linked from the consent screen — and
`id_token_signed_response_alg`, `default_max_age` and `require_auth_time`
are revalidated through the same
`parseClientMetadata` a create body runs through, against the amended
value merged with what the client already holds: a `redirect_uris` entry
registration would refuse is refused here with the identical `400` detail,
and narrowing `grant_types` takes effect on the very next `/token` request,
since nothing about a grant type is cached anywhere between the two.

Amending `token_endpoint_auth_method` to a value on the other side of the
public/confidential boundary — `none` for a confidential client, or
anything else for a public one — is refused with `409`, naming the
client's current type and the type the new method implies: the same
concern `type` itself being unamendable exists for, reached through a
different field. `client_secret_basic`, `client_secret_post` and
`private_key_jwt` are always confidential and freely amendable into one
another; `tls_client_auth` joins them only when TLS client authentication
is enabled (`ODUDU_TRUST_PROXY`) — `parseClientMetadata` refuses it
otherwise, on a create or an amend alike. `none` is the only public
method.

The built-in admin client (`builtin_admin`) is amended through an
allowlist, not an exclusion list: `name`, `description`, `client_uri`,
`policy_uri`, `tos_uri`, `consent_required`, the two logout URIs and their
`_session_required` flags, and the three `userinfo_*` algorithms. Every other field is refused with `409` naming
the field and the client, because each could leave every administrator of
the tenant locked out while the client stays enabled — `audiences` carries
the admin API's own resource identifier, `grant_types`,
`token_endpoint_auth_method` and `redirect_uris` decide how a token is
obtained at all, and recovery from any of them is through `psql`.
Disabling it (`enabled: false`) carries its own reason. Stated this way
round, a column added to `clients` or `client_oidc_config` later is
refused on this one client until somebody judges it safe, rather than
opening a fresh door by default. The guard reads the `builtin_admin`
column, not `client_id`, so renaming the client does not evade it. An
**ordinary** admin-capable client carries no such guard and may be
disabled even by the caller whose own token runs through it — the built-in
client is the recovery path that makes that permissible.

On `demo`'s `demo-operator` (`01a17d30-f50b-7f08-b8e4-8545f45df544`), created
there with `grant_types: ["client_credentials"]` and no `redirect_uris`.
Amending a list field without `If-Match`, and amending a field the exclusion
list names — the refusal carries the reason, not just the refusal:

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://demo-operator.example/callback"]}' \
  http://localhost:3080/admin/tenants/demo/clients/01a17d30-f50b-7f08-b8e4-8545f45df544
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "renamed"}' \
  http://localhost:3080/admin/tenants/demo/clients/01a17d30-f50b-7f08-b8e4-8545f45df544
```

```
{"type":"about:blank","title":"Precondition Required","status":428,"detail":"If-Match is required to amend redirect_uris","instance":"01a17d31-b2ec-7761-a65c-8acf5a90c9ab"}{"type":"about:blank","title":"Bad Request","status":400,"detail":"client_id: identity: changing it breaks every relying party and orphans the azp of every issued token","errors":[{"path":"client_id","message":"identity: changing it breaks every relying party and orphans the azp of every issued token"}],"instance":"01a17d31-b306-7679-bd69-142b132f001d"}
```

The revalidation is not a formality. Widening `demo-operator`'s grants
alone, with the `ETag` its `GET` answered, is refused, because the merged
metadata no longer satisfies the rule that excused the empty list:

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "ffa8393b3f1632eef3c3f9b790fa5d7baea818ed783af26863272b91ecd1b733"' \
  -d '{"grant_types": ["client_credentials","refresh_token"]}' \
  http://localhost:3080/admin/tenants/demo/clients/01a17d30-f50b-7f08-b8e4-8545f45df544
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"redirect_uris is required unless grant_types is exactly [\"client_credentials\"]","errors":[{"path":"redirect_uris","message":"redirect_uris is required unless grant_types is exactly [\"client_credentials\"]"}],"instance":"01a17d31-b322-7e29-bd66-c820ad083216"}
```

An amendment that does pass, with that same `ETag`, and the fresh one it
returns — its headers only:

```bash
curl -sS -D - -o /dev/null -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "ffa8393b3f1632eef3c3f9b790fa5d7baea818ed783af26863272b91ecd1b733"' \
  -d '{"audiences": ["https://api.demo.example"]}' \
  http://localhost:3080/admin/tenants/demo/clients/01a17d30-f50b-7f08-b8e4-8545f45df544
```

```
HTTP/1.1 200 OK
x-request-id: 01a17d31-b340-77af-a466-e11856c87e27
cache-control: no-store
etag: "67d85f9af89196d74b7d2f93efecdc5b16bc997b4c53899e38560c427473463c"
content-type: application/json; charset=utf-8
content-length: 1985
Date: Tue, 27 Oct 2026 11:49:31 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

Replaying the identical request — same `If-Match`, now one generation
stale — is refused and changes nothing:

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "ffa8393b3f1632eef3c3f9b790fa5d7baea818ed783af26863272b91ecd1b733"' \
  -d '{"audiences": ["https://api.demo.example"]}' \
  http://localhost:3080/admin/tenants/demo/clients/01a17d30-f50b-7f08-b8e4-8545f45df544
```

```
{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a17d31-b37d-78a4-95c8-f7c5bfd15dfb"}
```

**The two `409`s that disabling produces are told apart by one column, and
the admin API does not expose it**, so it is read from the database beside
them rather than asserted. `client-facts-demo` holds the two clients this
guard needs: its own built-in one, and `demo-backend` above:

```bash
docker compose exec -T postgres psql -U odudu -d odudu -c \
  "select client_id, builtin_admin, enabled from clients
     where tenant_id = '01a17d30-9dc2-7184-8573-c44eb3f5220e' order by client_id;"
```

```
  client_id   | builtin_admin | enabled
--------------+---------------+---------
 demo-backend | f             | t
 odudu-admin  | t             | t
(2 rows)
```

`demo-backend`, `builtin_admin` false, disables — and the response is the
whole client, so `enabled` can be read back from it, alongside
`builtin_admin` itself:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"enabled": false}' \
  http://localhost:3082/admin/tenants/client-facts-demo/clients/01a17d30-f6bf-7f10-b111-f613b93105fb
```

```
{"id":"01a17d30-f6bf-7f10-b111-f613b93105fb","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":false,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:48:43.287Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d30-f699-79b5-b8eb-264c767951f2","scopes":[{"id":"01a17d30-9dc4-71ad-9969-bb32fb3553f5","name":"openid","assignment":"default"},{"id":"01a17d30-9dc6-7064-9cd5-efdb8efceac3","name":"profile","assignment":"default"},{"id":"01a17d30-9dc7-7f33-9c63-df1bcfcb3a93","name":"email","assignment":"default"},{"id":"01a17d30-9dc9-7b65-907c-edf2cbb4d8f9","name":"address","assignment":"default"},{"id":"01a17d30-9dca-7bfe-bbd4-499683f46766","name":"phone","assignment":"default"},{"id":"01a17d30-9dcc-792c-97ce-9ceb98881273","name":"roles","assignment":"default"},{"id":"01a17d30-9dcd-7d5d-8406-2953bbfc060b","name":"groups","assignment":"default"},{"id":"01a17d30-9dce-725d-82b3-d9f031b0d9c2","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}
```

`odudu-admin`, `builtin_admin` true, the same request against the other id
in that listing, does not:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"enabled": false}' \
  http://localhost:3082/admin/tenants/client-facts-demo/clients/01a17d30-9dd1-7976-b67f-4cdb22c88e0d
```

```
{"type":"about:blank","title":"Conflict","status":409,"detail":"odudu-admin is this tenant's built-in admin client and cannot be disabled","instance":"01a17d31-b539-7ced-9e93-fe47caae291e"}
```

## A client's pages and its ID token settings

`description` is the administrators' own note on the client, at most 1000
characters and shown nowhere else. `client_uri`, `policy_uri` and `tos_uri` are
RFC 7591 §2's pages about the client, which the consent screen links under the
client's name ([The consent
screen](../request-paths/rp-initiated-logout.md#the-consent-screen)).
`id_token_signed_response_alg`, `default_max_age` and `require_auth_time` are
OpenID Connect Dynamic Client Registration §2's: the algorithm the client's ID
tokens are signed with (`RS256` or `ES256`, and only one a non-retired key of
the tenant produces; `null` signs with the active key), the age past which a
session is re-authenticated when a request carries no `max_age` of its own, and
whether every ID token carries `auth_time`. Dynamic registration accepts the
same six and echoes them. In a tenant `client-pages-demo` created for it:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "billing", "redirect_uris": ["https://billing.example/callback"], "grant_types": ["authorization_code", "client_credentials"], "description": "Invoices and payment runs", "client_uri": "https://billing.example/about", "policy_uri": "https://billing.example/privacy", "tos_uri": "https://billing.example/terms", "id_token_signed_response_alg": "ES256", "default_max_age": 3600, "require_auth_time": true}' \
  http://localhost:3082/admin/tenants/client-pages-demo/clients
```

```
{"id":"01a17d31-b5fd-7096-a520-8f02e1759627","client_id":"billing","name":"billing","description":"Invoices and payment runs","type":"confidential","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:49:32.193Z","redirect_uris":["https://billing.example/callback"],"grant_types":["authorization_code","client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":"https://billing.example/about","policy_uri":"https://billing.example/privacy","tos_uri":"https://billing.example/terms","id_token_signed_response_alg":"ES256","default_max_age":3600,"require_auth_time":true,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a17d31-b5a3-71ed-81a3-c4fb50d9490a","scopes":[{"id":"01a17d31-b55e-755c-9d44-396095286272","name":"openid","assignment":"default"},{"id":"01a17d31-b560-7446-9ce6-f1f0acb366ee","name":"profile","assignment":"default"},{"id":"01a17d31-b561-7acd-b321-267ca24150d3","name":"email","assignment":"default"},{"id":"01a17d31-b562-7943-aae3-8ad298691eb7","name":"address","assignment":"default"},{"id":"01a17d31-b564-7064-9a89-28da536104a7","name":"phone","assignment":"default"},{"id":"01a17d31-b565-7ec0-b498-b24c1bfd1a57","name":"roles","assignment":"default"},{"id":"01a17d31-b566-73ff-8e93-6b95c631f6de","name":"groups","assignment":"default"},{"id":"01a17d31-b568-7636-8916-30b4cb87aa04","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"AbQAxG3bPxG35qhODysepHyXkaCbVztpQqNaD9Mx1Dc"}
```

A page that is not https, or an algorithm no key of the tenant produces,
is refused by name — the tenant holds only the `ES256` key it was created
with:

```bash
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"policy_uri": "http://billing.example/privacy"}' \
  http://localhost:3082/admin/tenants/client-pages-demo/clients/01a17d31-b5fd-7096-a520-8f02e1759627
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"id_token_signed_response_alg": "RS256"}' \
  http://localhost:3082/admin/tenants/client-pages-demo/clients/01a17d31-b5fd-7096-a520-8f02e1759627
```

```
{"type":"about:blank","title":"Bad Request","status":400,"detail":"policy_uri must be an absolute https URI, or http on a loopback host, with no fragment","errors":[{"path":"policy_uri","message":"policy_uri must be an absolute https URI, or http on a loopback host, with no fragment"}],"instance":"01a17d31-b625-7c59-b343-32c6048d4212"}{"type":"about:blank","title":"Bad Request","status":400,"detail":"id_token_signed_response_alg: id_token_signed_response_alg RS256 is not produced by any of this tenant's signing keys (ES256)","errors":[{"path":"id_token_signed_response_alg","message":"id_token_signed_response_alg RS256 is not produced by any of this tenant's signing keys (ES256)"}],"instance":"01a17d31-b63d-738f-b575-05d073a34d22"}
```

## Turning the logout confirmation off for one client

`skip_logout_confirmation` is a boolean on the client, `false` for every client
but the console's own, and amended here like any other field. `/logout` asks
the End-User before it signs anyone out; a client with this on is signed out
without the page, but only for an ID token it was issued that names the live
session ([RP-initiated logout](../request-paths/rp-initiated-logout.md#a-client-may-skip-the-page)
shows both answers). Anyone holding such a token can then sign that user out by
opening a link, which is why only `manage-clients` may change it, why it is
audited as every amendment is, and why Dynamic Client Registration refuses it.
The field is not a list, so `If-Match` is optional, and a stale one is `412`.
It is guarded on the built-in `odudu-admin` client like every field outside the
short list that client may be amended through.

This ran on a new stack's port `3193`. In
the tenant `demo`, `$P` is `http://localhost:3193/admin/tenants/demo` and `$ID`
the client `reports`, seeded public a moment before with `odudu seed client`
and not touched since, so it holds the default. `$ADMIN_TOKEN` is the system
administrator's, got the way [Getting the token](./getting-the-token.md) shows.
The first request is the read, the second a stale `If-Match`, the third a value
that is not a boolean, and the last sends the `ETag` the read before it answered:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" $P/clients/$ID | grep -iE '^HTTP|^etag|^content-length'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" $P/clients/$ID | grep -o '"skip_logout_confirmation":[a-z]*'
echo '# a stale If-Match'
curl -sS -D - -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -H 'If-Match: "stale"' -d '{"skip_logout_confirmation":true}' $P/clients/$ID | grep -iE '^HTTP|^\{'
echo '# not a boolean'
curl -sS -D - -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"skip_logout_confirmation":"yes"}' $P/clients/$ID | grep -iE '^HTTP|^\{'
echo '# the current If-Match'
ETAG=$(curl -sS -D - -o /dev/null -H "Authorization: Bearer $ADMIN_TOKEN" $P/clients/$ID | sed -n 's/^etag: //p' | tr -d '\r')
echo "$ETAG"
curl -sS -D - -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -H "If-Match: $ETAG" -d '{"skip_logout_confirmation":true}' $P/clients/$ID > patch.txt
grep -iE '^HTTP|^etag' patch.txt; grep -o '"skip_logout_confirmation":[a-z]*' patch.txt
```

```
HTTP/1.1 200 OK
etag: "a516278ba1bcc32a45502d26cdb50c8638328d689e9ca675bce979fa0740315f"
content-length: 1938
"skip_logout_confirmation":false
# a stale If-Match
HTTP/1.1 412 Precondition Failed
{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a17d0d-b8d6-753e-b964-a27d04b5add0"}
# not a boolean
HTTP/1.1 400 Bad Request
{"type":"about:blank","title":"Bad Request","status":400,"detail":"skip_logout_confirmation: skip_logout_confirmation must be a boolean","errors":[{"path":"skip_logout_confirmation","message":"skip_logout_confirmation must be a boolean"}],"instance":"01a17d0d-b8f0-768e-8389-a897bbdff1d0"}
# the current If-Match
"a516278ba1bcc32a45502d26cdb50c8638328d689e9ca675bce979fa0740315f"
HTTP/1.1 200 OK
etag: "50b8f305e7848e8b1f5af400f2d4a32cd674b39f721d04fcc3edfe0118e5d180"
"skip_logout_confirmation":true
```

The amendment is one audit row, `client.amend`, whose detail names only the
field that changed. The query ran as the database owner against the same
stack, with `psql` the function the logout transcript defines, scoped to this
client:

```bash
psql -c "select a.action, a.outcome, a.detail from audit_events a join tenants t on t.id = a.tenant_id where t.name = 'demo' and a.resource_id = '$ID' and a.action = 'client.amend' order by a.occurred_at;"
```

```
    action    | outcome |                             detail
--------------+---------+----------------------------------------------------------------
 client.amend | allowed | {"skip_logout_confirmation": {"after": true, "before": false}}
(1 row)
```
