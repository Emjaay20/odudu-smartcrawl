---
title: 'POST /clients/{id}/secret'
description: "Requires manage-clients. Rotates a confidential client's secret: generates a fresh one, stores only its hash, and returns the plaintext exactly…"
---

# `POST /clients/{id}/secret`

Requires `manage-clients`. Rotates a confidential client's secret: generates a fresh one, stores only
its hash, and returns the plaintext **exactly once, in this response** —
the same guarantee `POST /clients` makes for a client's first secret.
Nothing reads it back afterward. By default the previous secret stops
authenticating at `/token`, `/introspect` and `/revoke` immediately, which is
the answer to a leaked one. `?grace_seconds=N`, from `0` to `604800` (a
week), keeps it authenticating beside the new one for `N` seconds instead,
so a client's deployments can move over without an outage; the response's
`previous_secret_expires_at` says when it stops, and every read of the
client says the same until then. A week covers a weekly deployment picking
up the new secret; a longer window would leave a second standing credential
nobody is tracking. Rotating again inside a window keeps only the secret
that rotation replaced, so at most two ever authenticate. Only the old
secret's hash is kept, never shown, and the audit row records
`grace_seconds` and `previous_secret_expires_at`, never a secret or a hash.
`odudu reap` clears the kept hash once the window has passed and audits
each one as `client.secret_expired`; the secret is refused from the instant
the window ends whether or not that pass has run. A public client
(`token_endpoint_auth_method: "none"`) has no secret to rotate, refused with
`409`.

On the same client, with an hour's grace: the response, narrowed, then
`client_credentials` at `/token` with the secret the create above answered and
with the new one, then a week and a second asked for, then the audit row the
rotation wrote:

```bash
ROTATED=$(curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/client-pages-demo/clients/01a10931-8140-71a8-821f-c964f28b806c/secret?grace_seconds=3600')
echo "$ROTATED" | jq -c '{client_id, previous_secret_expires_at, client_secret}'
NEW_SECRET=$(echo "$ROTATED" | jq -r .client_secret)
for secret in "$OLD_SECRET" "$NEW_SECRET"; do
  curl -sS -o /dev/null -w '%{http_code}\n' -u "billing:$secret" \
    -d grant_type=client_credentials \
    http://localhost:3082/tenants/client-pages-demo/protocol/openid-connect/token
done
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/client-pages-demo/clients/01a10931-8140-71a8-821f-c964f28b806c/secret?grace_seconds=604801'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/client-pages-demo/audit?action=client.rotate_secret' \
  | jq -c '.items[0] | {action, outcome, detail}'
```

```
{"client_id":"billing","previous_secret_expires_at":"2026-10-05T00:13:29.089Z","client_secret":"msYC9U85SlNkuYyb2bfBKAzYwI5bmqr6CFdlVp3E7yw"}
200
200
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/grace_seconds must be <= 604800","errors":[{"path":"grace_seconds","message":"must be <= 604800"}],"instance":"01a10931-9e9a-7afa-84c4-4ed5807be500"}
{"action":"client.rotate_secret","outcome":"allowed","detail":{"secret_hash":{"changed":true},"grace_seconds":3600,"previous_secret_expires_at":"2026-10-05T00:13:29.089Z"}}
```

A rotation without grace, on `client-facts-demo`'s `demo-backend`, straight
after the disable above, which is why `enabled` reads `false` here: rotating a
disabled client's secret is allowed, the guard being on the built-in client
rather than on a disabled one. `demo-backend` was deleted afterward, in the
`DELETE` section above.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/client-facts-demo/clients/$BACKEND/secret
```

```
{"id":"01a18711-835e-7d10-a840-d25d8f0c6913","client_id":"demo-backend","name":"demo-backend","description":null,"name_i18n":{},"description_i18n":{},"type":"confidential","enabled":false,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-29T09:50:34.307Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a18711-8344-73c5-8316-35912bfb7fa2","scopes":[{"id":"01a18711-8300-7911-a72a-e4415c270eb0","name":"openid","assignment":"default"},{"id":"01a18711-8303-7766-b3dd-3ad8269a70bb","name":"profile","assignment":"default"},{"id":"01a18711-8306-76a5-850e-4cfe7835aa27","name":"email","assignment":"default"},{"id":"01a18711-8309-7528-ab73-9ba0ec08be97","name":"address","assignment":"default"},{"id":"01a18711-830e-7d25-bb90-a0e9bdd4dd1c","name":"phone","assignment":"default"},{"id":"01a18711-8311-77e6-a868-7e509a78d398","name":"roles","assignment":"default"},{"id":"01a18711-8312-7985-ab88-e78af519d7f2","name":"groups","assignment":"default"},{"id":"01a18711-8313-7fd8-895d-1992d6117026","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[],"client_secret":"U_oawB8-6TL9WnVe0mtmmXPfTpsFWBXZHiMTS396mas"}
```

## The service account's ceiling

**A confidential client authenticates as its service account, so every route
that mutates one client is held to the target ceiling on that subject** — the
one the [subjects' target
ceiling](./post-subjectsidpassword.md#the-target-ceiling) applies to
`/subjects/{id}`. That is `PATCH`, `DELETE` and `POST …/secret` on
`/clients/{id}`, and `PUT` and `DELETE` on `/scopes/{id}/clients/{clientId}`.
Without it, a caller holding only `manage-clients` could rotate the secret of a
client whose service account holds `tenant-admin`, or swap its `jwks`, and then
act as `tenant-admin` through `client_credentials`. A caller missing any admin
capability the service account holds is refused with `403` naming what it lacks,
before anything else about the request is looked at, and the attempt writes a
`refused` row on the client (on the scope, for the two scope routes) with
`detail.denied`. A client with no service account, or one whose service account
holds no capability, is unaffected. An integration test reads these routes from
the route table too.

In a tenant `ceiling-clients` created for it, holding three `client_credentials`
clients with the admin audience, each created through `POST /clients`:
`ops-robot`, whose service account was given `manage-clients` through `PUT
/subjects/:id/roles`, so `$OPS_TOKEN` is its `client_credentials` token and
carries that capability alone; `root-robot`
(`01a17ae7-9e40-7808-bd8b-a6a37e47d28f`), whose service account was given
`tenant-admin` the same way; and `plain-robot`
(`01a17ae7-9fce-7e1c-84f6-00fee731dc44`), whose service account holds nothing.
The rotation, a `jwks` swap and the delete on `root-robot` are refused, a
rotation on `plain-robot` is not, and the refused rows are the three on
`root-robot`:

The same again, now that each row answers `actor_name` and `actor_origin`; the
ids are a fresh run's, not those above:

```bash
ROOT=http://localhost:3082/admin/tenants/ceiling-clients/clients/01a17ae7-9e40-7808-bd8b-a6a37e47d28f
curl -sS -X POST -H "Authorization: Bearer $OPS_TOKEN" "$ROOT/secret"
echo
curl -sS -X PATCH -H "Authorization: Bearer $OPS_TOKEN" -H 'content-type: application/json' \
  -d '{"jwks":{"keys":[]}}' "$ROOT"
echo
curl -sS -X DELETE -H "Authorization: Bearer $OPS_TOKEN" "$ROOT"
echo
curl -sS -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $OPS_TOKEN" \
  http://localhost:3082/admin/tenants/ceiling-clients/clients/01a17ae7-9fce-7e1c-84f6-00fee731dc44/secret
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/ceiling-clients/audit?resource_type=client&resource_id=01a17ae7-9e40-7808-bd8b-a6a37e47d28f&outcome=refused"
echo
```

```
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee8d-9d72-7aef-b030-5e4e844fb8d0"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee8d-9e1e-7367-ac27-387c29322f2b"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee8d-9e6e-7867-b29b-b95bbda04560"}
200
{"items":[{"id":"01a17ae8-648c-7810-a3fd-8b63b8f378f4","occurred_at":"2026-10-27T01:10:12.864Z","event_type":"admin_mutation","action":"client.delete","outcome":"refused","actor_tenant_id":"01a17ae7-9c04-7c65-88b0-bae9222a3acb","actor_subject_id":"01a17ae7-9c95-7b03-8a27-32f40d3c1f7a","actor_client_id":"01a17ae7-9cb0-7365-a04c-1cd4c4ca0bbc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a17ae7-9e40-7808-bd8b-a6a37e47d28f","request_id":"01a17ae8-646d-7106-8bea-5e4dc38d94d7","ip":"172.20.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a17ae8-6435-7995-90cb-353a810753d8","occurred_at":"2026-10-27T01:10:12.784Z","event_type":"admin_mutation","action":"client.amend","outcome":"refused","actor_tenant_id":"01a17ae7-9c04-7c65-88b0-bae9222a3acb","actor_subject_id":"01a17ae7-9c95-7b03-8a27-32f40d3c1f7a","actor_client_id":"01a17ae7-9cb0-7365-a04c-1cd4c4ca0bbc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a17ae7-9e40-7808-bd8b-a6a37e47d28f","request_id":"01a17ae8-6423-7974-bdf3-8d04f14e02ec","ip":"172.20.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a17ae8-6417-762f-87d9-560f2f7fe788","occurred_at":"2026-10-27T01:10:12.755Z","event_type":"admin_mutation","action":"client.rotate_secret","outcome":"refused","actor_tenant_id":"01a17ae7-9c04-7c65-88b0-bae9222a3acb","actor_subject_id":"01a17ae7-9c95-7b03-8a27-32f40d3c1f7a","actor_client_id":"01a17ae7-9cb0-7365-a04c-1cd4c4ca0bbc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a17ae7-9e40-7808-bd8b-a6a37e47d28f","request_id":"01a17ae8-6406-72a3-84e8-32350dbc6289","ip":"172.20.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a17ae8-4aed-7893-8339-29c2cf3e5627","occurred_at":"2026-10-27T01:10:06.310Z","event_type":"admin_mutation","action":"client.delete","outcome":"refused","actor_tenant_id":"01a17ae7-9c04-7c65-88b0-bae9222a3acb","actor_subject_id":"01a17ae7-9c95-7b03-8a27-32f40d3c1f7a","actor_client_id":"01a17ae7-9cb0-7365-a04c-1cd4c4ca0bbc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a17ae7-9e40-7808-bd8b-a6a37e47d28f","request_id":"01a17ae8-4ada-7a91-b098-064633e3ac78","ip":"172.20.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a17ae8-4acf-7305-8c58-cca86a3a2343","occurred_at":"2026-10-27T01:10:06.284Z","event_type":"admin_mutation","action":"client.amend","outcome":"refused","actor_tenant_id":"01a17ae7-9c04-7c65-88b0-bae9222a3acb","actor_subject_id":"01a17ae7-9c95-7b03-8a27-32f40d3c1f7a","actor_client_id":"01a17ae7-9cb0-7365-a04c-1cd4c4ca0bbc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a17ae7-9e40-7808-bd8b-a6a37e47d28f","request_id":"01a17ae8-4ac1-78fd-bf24-006f782cb380","ip":"172.20.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a17ae8-4ab6-7b95-a5ff-16edfdc5b647","occurred_at":"2026-10-27T01:10:06.259Z","event_type":"admin_mutation","action":"client.rotate_secret","outcome":"refused","actor_tenant_id":"01a17ae7-9c04-7c65-88b0-bae9222a3acb","actor_subject_id":"01a17ae7-9c95-7b03-8a27-32f40d3c1f7a","actor_client_id":"01a17ae7-9cb0-7365-a04c-1cd4c4ca0bbc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a17ae7-9e40-7808-bd8b-a6a37e47d28f","request_id":"01a17ae8-4aa9-737c-988b-8d4f4abfc185","ip":"172.20.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}}]}
```

The two scope routes, from `scopes-robot` in the same tenant, a client whose
service account was given `manage-tenant` alone, so `$SCOPES_TOKEN` carries
the capability the scope routes require and nothing else. Assigning `profile` to
`root-robot` and unassigning it are refused, assigning it to `plain-robot`
is not, and the rows on `profile` since `RUN_START` are the two refusals
and that assignment:

```bash
RUN_START=$(date -u +%FT%T.000Z)
PROFILE=http://localhost:3000/admin/tenants/ceiling-clients/scopes/01a17ae7-9c09-750f-8210-5285c9ca4071
curl -sS -X PUT -H "Authorization: Bearer $SCOPES_TOKEN" -H 'content-type: application/json' \
  -d '{"assignment":"optional"}' "$PROFILE/clients/01a17ae7-9e40-7808-bd8b-a6a37e47d28f"
echo
curl -sS -X DELETE -H "Authorization: Bearer $SCOPES_TOKEN" \
  "$PROFILE/clients/01a17ae7-9e40-7808-bd8b-a6a37e47d28f"
echo
curl -sS -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $SCOPES_TOKEN" \
  -H 'content-type: application/json' -d '{"assignment":"default"}' \
  "$PROFILE/clients/01a17ae7-9fce-7e1c-84f6-00fee731dc44"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/ceiling-clients/audit?resource_type=scope&resource_id=01a17ae7-9c09-750f-8210-5285c9ca4071&from=$RUN_START" \
  | jq -c '.items[] | {action, outcome, detail}'
```

```
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f3-37b7-7731-ab4c-f6f314031a4f"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-clients, manage-keys, manage-sessions, view-audit","instance":"01a0e5f3-37d3-76c0-b950-7753abe49ebb"}
200
{"action":"scope.assign_to_client","outcome":"allowed","detail":{}}
{"action":"scope.unassign_from_client","outcome":"refused","detail":{"denied":["view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
{"action":"scope.assign_to_client","outcome":"refused","detail":{"denied":["view-users","manage-users","manage-clients","manage-keys","manage-sessions","view-audit"]}}
```
