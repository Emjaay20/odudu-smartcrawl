---
title: 'Path C: client_credentials'
description: 'No user, no browser, no PKCE, no redirect. A confidential client authenticates as itself and gets a token for its own service account.'
---

## Path C: `client_credentials`

No user, no browser, no PKCE, no redirect. A confidential client
authenticates as itself and gets a token for its own service account.

```bash
curl -sS -u demo-backend:demo-backend-secret \
  --data-urlencode 'grant_type=client_credentials' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": ""
}
```

```json
{ "alg": "RS256", "kid": "01a0cb07-4e73-…", "typ": "at+jwt" }
{
  "iss": "http://localhost:3000/tenants/demo",
  "sub": "01a0cb07-5383-…",
  "aud": ["http://localhost:3000/tenants/demo"],
  "client_id": "demo-backend",
  "scope": "",
  "iat": 1790114573,
  "exp": 1790114873,
  "jti": "01a0cb24-ad9d-…",
  "grant_id": "01a0cb24-ad9c-7008-a633-66b1c904f789"
}
```

`sub` is the client's service-account subject, not any person.

**No ID token, and that is not an omission.** An ID token asserts that an
end user authenticated at a given time — `sub`, `auth_time`, `nonce`. Here
nobody did. Issuing one would be a claim about a human being where there is
no human being, which is why OIDC has no `client_credentials` flow at all.

**No refresh token either.** A refresh token exists to avoid re-involving a
user who is not present; this client can repeat the request whenever it
likes with the credentials it already holds.

The seed command gives a new client an empty `client_credentials` scope
allowlist, so the empty `scope` above is the only scope it can get. Asking
for anything, including `openid`, is refused:

```bash
curl -sS -u demo-backend:demo-backend-secret \
  --data-urlencode 'grant_type=client_credentials' --data-urlencode 'scope=openid' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{ "error": "invalid_scope" }
```

Which also means this token cannot be used at `/userinfo` — it has no
`openid` scope, and the endpoint says so specifically rather than pretending
the token is bad:

```
HTTP/1.1 403 Forbidden
www-authenticate: Bearer realm="userinfo", error="insufficient_scope"
```

**What the client does next:** call the API the token is for, and mint
another when it expires. There is nothing to store.
