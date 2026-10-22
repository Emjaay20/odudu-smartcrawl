---
title: Read a refusal
description: 'What an error from Odudu looks like and why it happened: a wrong password, an unknown client, a reused token, too much scope, a stale update.'
sidebar_position: 4
---

# Read a refusal

When Odudu says no, the answer has a shape that tells you who can act on it. A person at a sign-in page sees a short message. A client sees an OAuth error code. An admin tool sees a problem document with a status. Each refusal below says what you see, why it happens and what to do.

## 1. A wrong password

The sign-in form comes back with one message, whatever was wrong. A wrong password, a name nobody holds, a locked account and a disabled account all read the same, so the page cannot be used to find out which accounts exist.

```
<div class="alert" role="alert" id="form-error">
<ul>
<li id="form-error-0">Sign-in failed. Check your details and try again.</li>
</ul>
</div>
```

What to do: nothing in your app. The person tries again.

Full transcript: [A refused login says so](../reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#a-refused-login-says-so).

## 2. A client or redirect Odudu cannot trust

If the client is unknown, or the redirect address does not match one registered, Odudu does not redirect at all. It shows the error on its own page, because sending the person to an address it cannot vouch for would make it an open redirector.

```
<h1>Can&#39;t continue</h1>
<p><bdi>Unknown or disabled client</bdi></p>
<p><small>invalid_client</small></p>
```

The redirect address must match a registered one exactly, as a string. A trailing slash, a different case or an added query all fail.

```
http://localhost:8080/callback           200
http://localhost:8080/callback/          400
http://localhost:8080/Callback           400
http://localhost:8080/callback?x=1       400
http://LOCALHOST:8080/callback           400
http://localhost:8080/callback#f         400
```

What to do: register the exact address on the client.

Full transcript: [The branches](../reference/transcripts/request-paths/the-branches.md).

## 3. A code or refresh token used twice

An authorization code works once, and a refresh token works once. A second use answers `invalid_grant`, and Odudu revokes what the first use produced, because a second use means a copy exists somewhere.

```
{ "error": "invalid_grant" }
```

What to do: discard the tokens and send the person through sign-in again.

Full transcript: [Replaying an authorization code](../reference/transcripts/request-paths/path-b-refresh-rotation.md#replaying-an-authorization-code).

## 4. More scope than was granted

A refresh can ask for less than the grant holds, never more. Asking for more is refused with `invalid_scope`, and the token you sent is not used up, so your next honest request still works.

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$RT" \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'scope=openid profile email admin' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```
{ "error": "invalid_scope" }
```

What to do: ask for a scope the client is assigned.

Full transcript: [What a replay does not do](../reference/transcripts/request-paths/path-b-refresh-rotation.md#what-a-replay-does-not-do).

## 5. A wrong client secret

A confidential client that sends the wrong secret, or a client that does not exist, gets the same `401`. The answer does not say which.

```bash
curl -sS -w '\n%{http_code}\n' -H 'x-request-id: token-refused-wrong-secret' \
  -u demo-backend:wrong-secret --data-urlencode 'grant_type=client_credentials' \
  "$BASE/token"
```

```
{"error":"invalid_client"}
401
```

What to do: check the client's id and secret.

Full transcript: [What a refused token request leaves in the audit log](../reference/transcripts/request-paths/path-b-refresh-rotation.md#what-a-refused-token-request-leaves-in-the-audit-log).

## 6. A change made on a stale copy

Admin updates carry the `ETag` of the version they were based on. If somebody changed the user in the meantime, the update is refused with `412` and nothing is written.

```
HTTP/1.1 412 Precondition Failed
x-request-id: 01a13ff3-3986-786b-8fac-4370a66c669f
content-type: application/problem+json; charset=utf-8
```

```
{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a13ff3-3986-786b-8fac-4370a66c669f"}
```

What to do: read the user again and apply your change to the new version.

Full transcript: [PATCH …/subjects/{id}](../reference/transcripts/console-paths/patch-consoleapiadmintenantstenantsubjectsid.md).

## 7. A request from another site

The console refuses a write that does not come from itself. A request with the wrong `Origin`, or without the console's header, gets `403` before anything else runs.

```
HTTP/1.1 403 Forbidden
```

```
{"status":403,"type":"about:blank","title":"Forbidden","detail":"refused as cross-site: origin-mismatch","instance":"01a13ff3-6c8f-75c8-8cd7-2e257c06a71f"}
```

What to do: send both `Origin` and `X-Odudu-Console: 1` from the console's own origin.

Full transcript: [POST …/subjects, refused as cross-site](../reference/transcripts/console-paths/post-consoleapiadmintenantstenantsubjects-refused-as-cross-site.md).

## Where to go next

- [Sign a user in](./sign-a-user-in.md) shows the flow these refusals come from.
- All error codes are listed in the [error reference](../reference/generated/errors.md).
