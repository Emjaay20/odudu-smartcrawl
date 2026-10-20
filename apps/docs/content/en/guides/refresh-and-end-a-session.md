---
title: Refresh and end a session
description: Keep a person signed in by rotating refresh tokens, spot a stolen one, and sign them out so no token works again.
sidebar_position: 2
---

# Refresh and end a session

Access tokens are short on purpose. This guide shows how to get new ones without asking the person to sign in again, how Odudu catches a stolen refresh token, and how to end the session so that nothing it issued works afterwards.

It carries on from [Sign a user in](./sign-a-user-in.md), with the same tenant `demo` and client `demo-spa`.

## 1. Trade the refresh token for new tokens

When the access token is about to expire, send the refresh token to the token endpoint.

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$R1" \
  --data-urlencode 'client_id=demo-spa' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```
{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "refresh_token": "f6MHISD3w9RHfGDjlSerx…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid profile email"
}
```

Every refresh uses up the token you sent and gives you a new one. Store the new one and throw the old one away. There is no ID token in the answer, because nobody signed in. You may ask for less scope than the grant holds, never more.

Full transcript: [Path B: refresh rotation](../reference/transcripts/request-paths/path-b-refresh-rotation.md).

## 2. Treat a replayed refresh token as theft

If the token you already used arrives again, one of the two holders is not you. Odudu cannot tell which, so it refuses the replay and revokes the whole family, including the token you were about to use.

```
{ "error": "invalid_grant" }
```

When a refresh answers `invalid_grant`, drop your tokens and start again with [Sign a user in](./sign-a-user-in.md).

Full transcript: [Replaying a refresh token](../reference/transcripts/request-paths/path-b-refresh-rotation.md#replaying-a-refresh-token).

## 3. End the session

Send the browser to the tenant's `end_session_endpoint` with the ID token you got at sign-in, and the address to return to. Register that return address on the client first.

```bash
curl -sS -b cookies.txt -D - -o /dev/null \
  --get \
  --data-urlencode "id_token_hint=$ID_TOKEN" \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'post_logout_redirect_uri=http://localhost:8080/logged-out' \
  --data-urlencode 'state=xyz-bye' \
  "http://localhost:3000/tenants/demo/protocol/openid-connect/logout"
```

```
HTTP/1.1 302 Found
set-cookie: demo-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: demo-session-persistent=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
cache-control: no-store
location: http://localhost:8080/logged-out?state=xyz-bye
content-length: 0
```

Odudu clears both session cookies, ends the session and every grant that belongs to it, and sends the browser to your address with your `state`.

Full transcript: [RP-initiated logout](../reference/transcripts/request-paths/rp-initiated-logout.md).

## 4. Check that the tokens are dead

The refresh token that session issued no longer works.

```bash
curl -sS \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$REFRESH_TOKEN" \
  --data-urlencode 'client_id=demo-spa' \
  "http://localhost:3000/tenants/demo/protocol/openid-connect/token"
```

```
{ "error": "invalid_grant" }
```

An access token is a signed token, so an API that only checks the signature accepts it until it expires. An API that asks the introspection endpoint is told it is inactive straight away, and UserInfo refuses it. See [token introspection and revocation](../reference/transcripts/request-paths/rp-initiated-logout.md#token-introspection-and-revocation).

## Where to go next

- [Read a refusal](./read-a-refusal.md) explains the errors you will meet.
- [Sign a user in](./sign-a-user-in.md) starts the flow.
