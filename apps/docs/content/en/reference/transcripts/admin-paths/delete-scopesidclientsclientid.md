---
title: 'DELETE /scopes/:id/clients/:clientId'
description: "Requires manage-tenant. Removes the client's assignment of the scope, whether it was default or optional — the inverse of PUT…"
---

# `DELETE /scopes/:id/clients/:clientId`

Requires `manage-tenant`. Removes the client's assignment of the scope, whether
it was `default` or `optional` — the inverse of `PUT
/scopes/:id/clients/:clientId` above, and the only way to take a scope back off
a client once assigned; `clientScopeRepository.unassign` deletes the row
outright rather than narrowing it. Answers `204`; a scope not currently assigned
to the client, an unknown scope id or an unknown client id all answer `404`; and
the same `403` as `PUT` above refuses a client whose service account holds what
the caller does not.

**The tenant's built-in admin client keeps every scope assignment**: unassigning
one answers `409`, naming the scope and the client. That client is public, with
no secret, and supports no grant but `authorization_code`/`refresh_token`
(`provisionAdminClient`) — an administrator's only path to a fresh admin token
is `/authorize`, and `scopesAreGrantable` refuses any scope the client is not
assigned, `openid` included, which a request naming no `scope` asks for by
default. Unassigning `openid` from this one client, or any of the others, would
lock every administrator of the tenant out of a fresh login once their existing
refresh token expired — the same lockout `PATCH /clients/{id}` and `DELETE
/roles/:id` refuse for the same client, read from the same `builtin_admin`
column. An ordinary client's own assignments carry no such guard: unassigning
its `openid` narrows what `/authorize` grants it next, exactly as an unknown
scope would.

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

In a tenant `scope-unassign-demo` made for this section, on a public client
`scope-unassign-app` registered for `authorization_code`. `POST /clients`
assigned it the tenant's default vocabulary, `openid` included, so `/authorize`
first renders the login form:

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
  http://localhost:3082/admin/tenants/scope-unassign-demo/scopes/01a17d32-2945-7104-a213-46f605d08cb0/clients/01a17d32-2989-7ddc-9a2f-aebf624f2357

curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-unassign-demo/clients/01a17d32-2989-7ddc-9a2f-aebf624f2357
echo
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/scope-unassign-demo/scopes/01a17d32-2945-7104-a213-46f605d08cb0/clients/01a17d32-2989-7ddc-9a2f-aebf624f2357
```

```
HTTP/1.1 204 No Content
x-request-id: 01a17d32-720c-7574-83dc-6b10dd18469d
cache-control: no-store
etag: "664eafd49644b80654740cf72ef9c0bd8ecf2aef4acb772badba2086f7a96523"
Date: Tue, 27 Oct 2026 11:50:20 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a17d32-2989-7ddc-9a2f-aebf624f2357","client_id":"scope-unassign-app","name":"scope-unassign-app","description":null,"type":"public","enabled":true,"full_scope_allowed":false,"skip_logout_confirmation":false,"registration_origin":"operator","created_at":"2026-10-27T11:50:01.864Z","redirect_uris":["https://app.example/callback"],"grant_types":["authorization_code"],"token_endpoint_auth_method":"none","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"previous_secret_expires_at":null,"builtin_admin":false,"service_subject_id":null,"scopes":[{"id":"01a17d32-2946-7090-86aa-3c0b71bacfd6","name":"profile","assignment":"default"},{"id":"01a17d32-2947-7d59-ab26-1983ad1f0837","name":"email","assignment":"default"},{"id":"01a17d32-2949-7a5d-b550-030d471f919d","name":"address","assignment":"default"},{"id":"01a17d32-294a-7445-881b-4977dcd7d600","name":"phone","assignment":"default"},{"id":"01a17d32-294c-794c-86b1-38822e1dd1a7","name":"roles","assignment":"default"},{"id":"01a17d32-294d-7331-aeca-0b34dbd897d2","name":"groups","assignment":"default"},{"id":"01a17d32-294e-764f-97da-ad452b023473","name":"offline_access","assignment":"optional"}],"service_account_admin_reach":[]}
HTTP/1.1 404 Not Found
x-request-id: 01a17d32-7247-7b57-a3c2-c02bc75cc35c
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 222
Date: Tue, 27 Oct 2026 11:50:20 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Not Found","status":404,"detail":"scope 01a17d32-2945-7104-a213-46f605d08cb0 is not assigned to client 01a17d32-2989-7ddc-9a2f-aebf624f2357","instance":"01a17d32-7247-7b57-a3c2-c02bc75cc35c"}
```

`/authorize`, asked for `openid` again, now refuses it the same way an
unregistered scope would — `state` and `iss` still carried back, the same
as any other redirect-side refusal:

```bash
curl -sS -D - -o /dev/null \
  'http://localhost:3194/tenants/scope-unassign-demo/protocol/openid-connect/auth?response_type=code&client_id=scope-unassign-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid&state=xyz&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
```

```
HTTP/1.1 302 Found
x-request-id: 01a17d32-8c9a-7fcb-8a71-2642be0d0ae6
location: https://app.example/callback?error=invalid_scope&error_description=A+requested+scope+is+not+available+to+this+client.&state=xyz&iss=http%3A%2F%2Flocalhost%3A3194%2Ftenants%2Fscope-unassign-demo
content-length: 0
Date: Tue, 27 Oct 2026 11:50:27 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```
