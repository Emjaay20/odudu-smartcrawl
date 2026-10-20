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

Captured on the same client, with an hour's grace: the response, narrowed,
then `client_credentials` at `/token` with the secret the create above
answered and with the new one, then a week and a second asked for, then the
audit row the rotation wrote:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/client-pages-demo/clients/01a10931-8140-71a8-821f-c964f28b806c/secret?grace_seconds=3600' \
  | jq -c '{client_id, previous_secret_expires_at, client_secret}'
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

A rotation without grace, on `client-facts-demo`'s `demo-backend`:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/client-facts-demo/clients/01a109b6-1fa9-7304-8ae5-f714f746785e/secret
```

Captured immediately after the disable above, which is why `enabled` reads
`false` here: rotating a disabled client's secret is allowed, the guard
being on the built-in client rather than on a disabled one. `demo-backend`
was deleted afterward, in the `DELETE` section above.

```
{"id":"01a109b6-1fa9-7304-8ae5-f714f746785e","client_id":"demo-backend","name":"demo-backend","description":null,"type":"confidential","enabled":false,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-05T01:38:13.006Z","redirect_uris":[],"grant_types":["client_credentials"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":"01a109b6-1f8f-725e-9c2c-53656397b36c","scopes":[{"id":"01a109b6-1dd0-7600-9e14-7816d44df6e6","name":"openid","assignment":"default"},{"id":"01a109b6-1dd0-7600-9e14-7817de7c7d68","name":"profile","assignment":"default"},{"id":"01a109b6-1dd1-715a-b073-4693dd489102","name":"email","assignment":"default"},{"id":"01a109b6-1dd1-715a-b073-4694a189e4be","name":"address","assignment":"default"},{"id":"01a109b6-1dd2-747c-97bd-c431358429af","name":"phone","assignment":"default"},{"id":"01a109b6-1dd2-747c-97bd-c432be4c4a58","name":"roles","assignment":"default"},{"id":"01a109b6-1dd3-7b41-8bf3-e8da34d0a2c0","name":"groups","assignment":"default"},{"id":"01a109b6-1dd3-7b41-8bf3-e8db9126a263","name":"offline_access","assignment":"optional"}],"client_secret":"IcaN1Ciqg5Lvi62CjT1hwWAKWl1MDWWUYavbJo97oi8"}
```

## The service account's ceiling

**A confidential client authenticates as its service account, so every
route that mutates one client is held to the target ceiling on that
subject** — the one the [subjects' target ceiling](./post-subjectsidpassword.md#the-target-ceiling)
applies to `/subjects/{id}`. That is `PATCH`, `DELETE` and `POST …/secret`
on `/clients/{id}`, and `PUT` and `DELETE` on
`/scopes/{id}/clients/{clientId}`. Without it, a caller holding only
`manage-clients` could rotate the secret of a client whose service account
holds `tenant-admin`, or swap its `jwks`, and then act as `tenant-admin`
through `client_credentials`. A caller missing any admin capability the
service account holds is refused with `403` naming what it lacks, before
anything else about the request is looked at, and the attempt writes a
`refused` row on the client (on the scope, for the two scope routes) with
`detail.denied`. A client with no service account, or one whose service
account holds no capability, is unaffected. `tests/target-ceiling.int.test.ts`
reads these routes from the route table too.

Captured against a tenant `ceiling-clients` created for it, holding three
`client_credentials` clients with the admin audience, each created through
`POST /clients`: `ops-robot`, whose service account was given
`manage-clients` through `PUT /subjects/:id/roles`, so `$OPS_TOKEN` is its
`client_credentials` token and carries that capability alone;
`root-robot` (`01a0e58a-ac43-7148-8881-6c3fdc6cf1ae`), whose service
account was given `tenant-admin` the same way; and `plain-robot`
(`01a0e58a-aca8-786f-a574-21674f047897`), whose service account holds
nothing. The rotation, a `jwks` swap and the delete on `root-robot` are
refused, a rotation on `plain-robot` is not, and the refused rows are the
three on `root-robot`:

Recaptured against the tenth stack, once each row answered `actor_name` and
`actor_origin`, after the same three clients were made there in a tenant of
the same name and their service accounts given the same roles, so the ids
are that run's, not those above:

```bash
ROOT=http://localhost:3082/admin/tenants/ceiling-clients/clients/01a0ee8d-9a7c-7c78-85bd-60906ed648c4
curl -sS -X POST -H "Authorization: Bearer $OPS_TOKEN" "$ROOT/secret"
echo
curl -sS -X PATCH -H "Authorization: Bearer $OPS_TOKEN" -H 'content-type: application/json' \
  -d '{"jwks":{"keys":[]}}' "$ROOT"
echo
curl -sS -X DELETE -H "Authorization: Bearer $OPS_TOKEN" "$ROOT"
echo
curl -sS -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $OPS_TOKEN" \
  http://localhost:3082/admin/tenants/ceiling-clients/clients/01a0ee8d-9b1f-7e8a-a358-ac868a9d5ff8/secret
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/ceiling-clients/audit?resource_type=client&resource_id=01a0ee8d-9a7c-7c78-85bd-60906ed648c4&outcome=refused"
echo
```

```
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee8d-9d72-7aef-b030-5e4e844fb8d0"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee8d-9e1e-7367-ac27-387c29322f2b"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the client's service account holds what the caller does not: view-users, manage-users, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee8d-9e6e-7867-b29b-b95bbda04560"}
200
{"items":[{"id":"01a0ee8d-9e95-7c5f-9119-4c27c3f4778a","occurred_at":"2026-09-29T19:04:13.711Z","event_type":"admin_mutation","action":"client.delete","outcome":"refused","actor_tenant_id":"01a0ee8d-9906-7ea0-b0d0-b27c727122fc","actor_subject_id":"01a0ee8d-99a1-7ad9-9e10-15e628d32b27","actor_client_id":"01a0ee8d-99d0-788f-939c-578f783208dc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a0ee8d-9a7c-7c78-85bd-60906ed648c4","request_id":"01a0ee8d-9e6e-7867-b29b-b95bbda04560","ip":"172.22.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a0ee8d-9e46-701d-9e8e-27e1361b03a9","occurred_at":"2026-09-29T19:04:13.624Z","event_type":"admin_mutation","action":"client.amend","outcome":"refused","actor_tenant_id":"01a0ee8d-9906-7ea0-b0d0-b27c727122fc","actor_subject_id":"01a0ee8d-99a1-7ad9-9e10-15e628d32b27","actor_client_id":"01a0ee8d-99d0-788f-939c-578f783208dc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a0ee8d-9a7c-7c78-85bd-60906ed648c4","request_id":"01a0ee8d-9e1e-7367-ac27-387c29322f2b","ip":"172.22.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a0ee8d-9e07-74d8-99ba-e12aab225392","occurred_at":"2026-09-29T19:04:13.533Z","event_type":"admin_mutation","action":"client.rotate_secret","outcome":"refused","actor_tenant_id":"01a0ee8d-9906-7ea0-b0d0-b27c727122fc","actor_subject_id":"01a0ee8d-99a1-7ad9-9e10-15e628d32b27","actor_client_id":"01a0ee8d-99d0-788f-939c-578f783208dc","actor_name":"ops-robot","actor_origin":"tenant","resource_type":"client","resource_id":"01a0ee8d-9a7c-7c78-85bd-60906ed648c4","request_id":"01a0ee8d-9d72-7aef-b030-5e4e844fb8d0","ip":"172.22.0.1","detail":{"denied":["view-users","manage-users","manage-tenant","manage-keys","manage-sessions","view-audit"]}}]}
```

The two scope routes, from `scopes-robot` in the same tenant, a client whose
service account was given `manage-tenant` alone, so `$SCOPES_TOKEN` carries
the capability the scope routes require and nothing else. Assigning `profile` to
`root-robot` and unassigning it are refused, assigning it to `plain-robot`
is not, and the rows on `profile` since `RUN_START` are the two refusals
and that assignment:

```bash
RUN_START=$(date -u +%FT%T.000Z)
PROFILE=http://localhost:3000/admin/tenants/ceiling-clients/scopes/01a0e58a-ab1f-7f4e-9e3e-c4574290cf56
curl -sS -X PUT -H "Authorization: Bearer $SCOPES_TOKEN" -H 'content-type: application/json' \
  -d '{"assignment":"optional"}' "$PROFILE/clients/01a0e58a-ac43-7148-8881-6c3fdc6cf1ae"
echo
curl -sS -X DELETE -H "Authorization: Bearer $SCOPES_TOKEN" \
  "$PROFILE/clients/01a0e58a-ac43-7148-8881-6c3fdc6cf1ae"
echo
curl -sS -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $SCOPES_TOKEN" \
  -H 'content-type: application/json' -d '{"assignment":"default"}' \
  "$PROFILE/clients/01a0e58a-aca8-786f-a574-21674f047897"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/ceiling-clients/audit?resource_type=scope&resource_id=01a0e58a-ab1f-7f4e-9e3e-c4574290cf56&from=$RUN_START" \
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
