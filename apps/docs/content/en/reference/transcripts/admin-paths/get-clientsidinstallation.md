---
title: 'GET /clients/:id/installation'
description: "Requires manage-clients. What a relying party is configured with: the issuer and its discovery URL, as this request's own host names them — the…"
---

# `GET /clients/:id/installation`

Requires `manage-clients`. What a relying party is configured with: the issuer
and its discovery URL, as this request's own host names them — the issuer a
relying party configured from here will check `iss` against — and the client's
`client_id`, type, authentication method, redirect and post-logout URIs, grant
types and default scopes. Never the secret, which is shown once, at creation
or rotation. An unknown client answers `404`.

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/clients/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123/installation"; echo
```

```
{"issuer":"http://localhost:3082/tenants/ops-demo","discovery_url":"http://localhost:3082/tenants/ops-demo/.well-known/openid-configuration","client_id":"ops-app","client_type":"confidential","token_endpoint_auth_method":"client_secret_basic","redirect_uris":["https://app.example/callback"],"post_logout_redirect_uris":[],"grant_types":["authorization_code","refresh_token"],"default_scope":"openid profile email address phone roles groups"}
```
