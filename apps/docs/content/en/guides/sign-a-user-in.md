---
title: Sign a user in
description: Send a person to Odudu to sign in and get back tokens your app can trust, with the authorization code flow and PKCE.
sidebar_position: 1
---

# Sign a user in

Your app sends a person to Odudu. They sign in on Odudu's own page. Your app then gets back tokens it can trust. This is the authorization code flow with PKCE, and every client uses it, public or confidential.

The examples use a tenant called `demo`, a single-page app registered as `demo-spa`, and a user called `ada`. Use your own names. Each step shows a trimmed piece of a real run and links to the whole thing.

## 1. Find the endpoints

Ask the tenant for its discovery document. Everything else in this guide comes from it: where to send people, where to swap a code for tokens, and where the signing keys are.

```bash
curl -sS http://localhost:3000/tenants/demo/.well-known/openid-configuration
```

```
  "issuer": "http://localhost:3000/tenants/demo",
  "authorization_endpoint": "http://localhost:3000/tenants/demo/protocol/openid-connect/auth",
  "token_endpoint": "http://localhost:3000/tenants/demo/protocol/openid-connect/token",
```

These are the first members of the answer. Full transcript: [Path A, discovery](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#1-discovery).

## 2. Make a PKCE pair

Before you send anyone anywhere, make a random secret, the verifier, and its fingerprint, the challenge. Keep the verifier. Send only the challenge.

```bash
VERIFIER=$(openssl rand -hex 32)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 \
  | openssl base64 | tr '+/' '-_' | tr -d '=')
```

Full transcript: [Path A, /authorize](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#2-authorize).

## 3. Send the person to Odudu

Redirect the browser to the authorization endpoint. Add a `state` you will compare when the person comes back, and a `nonce` that will appear in the ID token.

```bash
curl -sS -D - --get \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'scope=openid profile email' \
  --data-urlencode 'state=xyz-123' \
  --data-urlencode 'nonce=n-0S6_WzA2Mj' \
  --data-urlencode "code_challenge=$CHALLENGE" \
  --data-urlencode 'code_challenge_method=S256' \
  'http://localhost:3197/tenants/demo/protocol/openid-connect/auth'
```

(This run used another port, 3197.) Odudu answers with its own sign-in page, named for your client and the tenant. The `set-cookie` header is how Odudu remembers, for thirty minutes, which sign-in this browser started; you do nothing with it.

```
HTTP/1.1 200 OK
x-request-id: 01a1647b-2c1e-7ca8-a195-91f4799076e0
set-cookie: odudu-sign-in=01a1647b-2c2b-793d-b112-fbeacaf248f2.JXiLxsWqKLuPc5x42YKrEpXHxOrvmO_Rt4EC7SJtKSw; HttpOnly; SameSite=Lax; Path=/tenants/demo/; Max-Age=1800
content-type: text/html
```

```
<h1>Sign in</h1>
<p class="context">to continue to <bdi>demo-spa</bdi></p>
<p class="tenant"><bdi>demo</bdi></p>
```

Full transcript: [Path A, /authorize](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#2-authorize).

## 4. The person signs in

The person types a name and a password, or uses a passkey. You do nothing while they do. When it works, Odudu sends the browser back to your redirect address with a one-time `code`.

```
HTTP/1.1 302 Found
set-cookie: demo-session=01a0de0f-e0c1-…:ymX2RgGntNQX…; HttpOnly; SameSite=Lax; Path=/
set-cookie: demo-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
location: http://localhost:8080/callback?code=BHGxL9ZKCpm7…&state=xyz-123&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Fdemo
```

Check three things before you use the code. `state` must equal what you sent. `iss` must name the Odudu tenant you started with. The code lives for 60 seconds by default and works once.

Full transcript: [Path A, the login POST](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#3-the-login-post).

## 5. Swap the code for tokens

From your server, or from the app for a public client, send the code and the verifier to the token endpoint.

```bash
curl -sS -D - \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode "code_verifier=$VERIFIER" \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```
HTTP/1.1 200 OK
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8

{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "id_token": "eyJhbGciOiJSUzI1NiIs…",
  "refresh_token": "HyqdGK5v2WV2lTarwqmC…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid profile email"
}
```

The access token is what you send to your APIs. The ID token says who signed in. The refresh token gets new tokens later. The access token here lives 300 seconds. Verify the ID token's signature against the tenant's keys and check its `nonce` before you trust it.

Full transcript: [Path A, /token](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#4-token).

## 6. Ask who signed in

Send the access token to the UserInfo endpoint to read the person's claims.

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:3000/tenants/demo/protocol/openid-connect/userinfo
```

```
{
  "sub": "01a0cb07-4e76-…",
  "name": "ada",
  "preferred_username": "ada",
  "email": "ada@example.com",
  "email_verified": false,
  "iss": "http://localhost:3000/tenants/demo",
  "aud": "demo-spa",
  "iat": 1790112846,
  "exp": 1790113146,
  "nonce": "n-0S6_WzA2Mj",
  "sid": "01a0cb0a-5198-…",
  "amr": ["pwd"],
  "acr": "1"
}
```

Full transcript: [Path A, /userinfo](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#5-userinfo).

## Run a finished app

Everything above is what an app does for you. To see it done in code, run [the single-page app example](https://github.com/wizzywit/odudu/tree/main/examples/single-page-app), which signs a person in from the browser, or [the web app example](https://github.com/wizzywit/odudu/tree/main/examples/web-app), whose server keeps a secret. Each README says how to run it against your stack.

## Where to go next

- [Refresh and end a session](./refresh-and-end-a-session.md) keeps the person signed in and signs them out.
- [Read a refusal](./read-a-refusal.md) explains what each error means.
- The whole flow, with every header, is in [Path A: authorization code with PKCE](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md).
