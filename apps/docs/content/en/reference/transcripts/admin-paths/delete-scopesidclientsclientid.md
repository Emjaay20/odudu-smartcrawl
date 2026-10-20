---
title: 'DELETE /scopes/:id/clients/:clientId'
description: "Requires manage-tenant. Removes the client's assignment of the scope, whether it was default or optional — the inverse of PUT…"
---

# `DELETE /scopes/:id/clients/:clientId`

Requires `manage-tenant`. Removes the client's assignment of the scope,
whether it was `default` or `optional` — the inverse of
`PUT /scopes/:id/clients/:clientId` above, and the only way to take a scope
back off a client once assigned; `clientScopeRepository.unassign`
(`packages/domain-tenant/src/repository/client-scopes.ts`) deletes the row
outright rather than narrowing it. Answers `204`; a scope not currently
assigned to the client, an unknown scope id or an unknown client id all
answer `404`; and the same `403` as `PUT` above refuses a client whose
service account holds what the caller does not.

**The tenant's built-in admin client keeps every scope assignment**:
unassigning one answers `409`, naming the scope and the client. That
client is public, with no secret, and supports no grant but
`authorization_code`/`refresh_token` (`provisionAdminClient`,
`packages/protocol-oidc/src/usecase/provision-admin-client.ts`) — an
administrator's only path to a fresh admin token is `/authorize`, and
`scopesAreGrantable` (`packages/protocol-oidc/src/service/authorize-validation.ts`)
refuses any scope the client is not assigned, `openid` included, which a
request naming no `scope` asks for by default. Unassigning `openid` from
this one client, or any of the others, would lock every administrator of
the tenant out of a fresh login once their existing refresh token expired
— the same lockout `PATCH /clients/{id}` and `DELETE /roles/:id` refuse for
the same client, read from the same `builtin_admin` column. An ordinary
client's own assignments carry no such guard: unassigning its `openid`
narrows what `/authorize` grants it next, exactly as an unknown scope
would.

The guard, against a tenant `scope-guard-demo` made for it, on its
built-in admin client `odudu-admin` and its own `openid` assignment:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/scope-guard-demo/scopes/01a0e236-f087-7c6a-946d-7aa6aea279bc/clients/01a0e236-f091-7ca4-a3f4-33841c633cf6
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a0e54e-328a-7b7e-b4c1-59ffbdc17acf
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 284
Date: Sun, 27 Sep 2026 23:58:22 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Conflict","status":409,"detail":"the scope openid on odudu-admin, this tenant’s built-in admin client, cannot be unassigned: it could leave every administrator of this tenant locked out of /authorize","instance":"01a0e54e-328a-7b7e-b4c1-59ffbdc17acf"}
```

Recaptured against the twelfth stack, in a tenant `scope-unassign-demo` made
for this section, on a public client `scope-unassign-app` registered for
`authorization_code`.
`POST /clients` assigned it the tenant's default vocabulary, `openid`
included, so `/authorize` first renders the login form:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://localhost:3082/tenants/scope-unassign-demo/protocol/openid-connect/auth?response_type=code&client_id=scope-unassign-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid&state=xyz&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
```

```
200
```

Unassigning `openid`, then reading the client back — the scope is gone from
`scopes`, `profile` now first — then the same removal repeated. The `204`
carries the client's new `ETag`, the one that read answers;
`scope-unassign-app` is public, so `service_subject_id` reads `null`:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-unassign-demo/scopes/01a109b7-d4cb-7d70-8819-84944ef99955/clients/01a109b7-d4ff-72db-90a3-044efab12332

curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-unassign-demo/clients/01a109b7-d4ff-72db-90a3-044efab12332

curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-unassign-demo/scopes/01a109b7-d4cb-7d70-8819-84944ef99955/clients/01a109b7-d4ff-72db-90a3-044efab12332
```

```
HTTP/1.1 204 No Content
x-request-id: 01a109b7-d53a-7f8b-b6c6-8d2bc91ea83e
cache-control: no-store
etag: "d577711acc23b187327a97d02ab5f7abee1ff3a14aac707bd4d8a96d73b7766c"
Date: Mon, 05 Oct 2026 01:40:05 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a109b7-d4ff-72db-90a3-044efab12332","client_id":"scope-unassign-app","name":"scope-unassign-app","description":null,"type":"public","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","created_at":"2026-10-05T01:40:04.990Z","redirect_uris":["https://app.example/callback"],"grant_types":["authorization_code"],"token_endpoint_auth_method":"none","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":null,"scopes":[{"id":"01a109b7-d4cc-7147-b8f0-70228a1a5a5c","name":"profile","assignment":"default"},{"id":"01a109b7-d4cd-7809-8aee-499efe11e1e1","name":"email","assignment":"default"},{"id":"01a109b7-d4cd-7809-8aee-499f5483c7bd","name":"address","assignment":"default"},{"id":"01a109b7-d4ce-7558-9abe-03d84d660f1a","name":"phone","assignment":"default"},{"id":"01a109b7-d4ce-7558-9abe-03d94c59122b","name":"roles","assignment":"default"},{"id":"01a109b7-d4cf-7cbe-ae62-cc913545931b","name":"groups","assignment":"default"},{"id":"01a109b7-d4cf-7cbe-ae62-cc92fb5695ab","name":"offline_access","assignment":"optional"}]}

HTTP/1.1 404 Not Found
x-request-id: 01a109b7-d565-7932-821a-445eb045285c
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 222
Date: Mon, 05 Oct 2026 01:40:05 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Not Found","status":404,"detail":"scope 01a109b7-d4cb-7d70-8819-84944ef99955 is not assigned to client 01a109b7-d4ff-72db-90a3-044efab12332","instance":"01a109b7-d565-7932-821a-445eb045285c"}
```

`/authorize`, asked for `openid` again, now refuses it the same way an
unregistered scope would — `state` and `iss` still carried back, the same
as any other redirect-side refusal:

```bash
curl -sS -D - -o /dev/null \
  'http://localhost:3082/tenants/scope-unassign-demo/protocol/openid-connect/auth?response_type=code&client_id=scope-unassign-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid&state=xyz&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
```

```
HTTP/1.1 302 Found
x-request-id: 01a109b7-d579-793d-91fe-ea746b588ac8
location: https://app.example/callback?error=invalid_scope&state=xyz&iss=http%3A%2F%2Flocalhost%3A3082%2Ftenants%2Fscope-unassign-demo
content-length: 0
Date: Mon, 05 Oct 2026 01:40:05 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```
