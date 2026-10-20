---
title: Sign people in to a single-page app
description: Register a single-page or mobile app that cannot keep a secret, allow its origin to call Odudu from the browser and sign a person in with PKCE.
sidebar_position: 6
---

# Sign people in to a single-page app

A single-page app runs in the person's browser, so anything you put in it can be read. It cannot keep a secret. That makes it a public client: instead of a secret it uses PKCE, a one-time proof that only the app that started a sign-in can finish it. You will register the app, check that its browser may call Odudu, and sign a person in.

You need the stack from the [quick start](../quick-start/index.md), with its `demo` tenant and its user `ada`. Run the commands in the folder that holds `compose.yaml`, in bash or zsh, with `curl` and `openssl` installed. Mobile apps follow the same steps.

## 1. Point the commands at your server

If you moved the port in the quick start, use that address instead of 3000.

```sh {run}
export ODUDU_BASE="${ODUDU_BASE:-http://localhost:3000}" && export TENANT="$ODUDU_BASE/tenants/demo"
```

## 2. Register the app

Register `my-spa` as a public client. Give it three addresses: where Odudu sends the person after they sign in, where it may send them after they sign out, and the origin your app is served from. The origin is what lets the browser talk to Odudu directly.

```sh {run expect="clientDbId"}
docker compose exec odudu odudu seed client --tenant demo --client-id my-spa --public --redirect-uri http://localhost:8080/callback --post-logout-redirect-uri http://localhost:8080/ --web-origin http://localhost:8080
```

## 3. Check the browser may call Odudu

Before a browser calls another origin it asks permission with a preflight request. Odudu answers it for the origins you registered and for no others. Here is the preflight your app's origin sends before it swaps a code.

```sh {run expect="access-control-allow-origin: http://localhost:8080"}
curl -sS -D - -o /dev/null -X OPTIONS -H "Origin: http://localhost:8080" -H 'Access-Control-Request-Method: POST' "$TENANT/protocol/openid-connect/token"
```

An origin you did not register gets no permission.

```sh {run expect="404"}
curl -sS -o /dev/null -w '%{http_code}\n' -X OPTIONS -H "Origin: http://evil.example" -H 'Access-Control-Request-Method: POST' "$TENANT/protocol/openid-connect/token"
```

The full exchange, with the header on the real request too, is in [CORS: the preflight and the request differ](../reference/transcripts/request-paths/cors-the-preflight-and-the-request-differ.md).

## 4. Make the PKCE pair

The app makes a random verifier and its fingerprint, the challenge. It keeps the verifier in memory and sends only the challenge. In a browser the fingerprint is a SHA-256 hash, written in URL-safe base64 with no padding.

```sh {run}
VERIFIER=$(openssl rand -hex 32)
```

```sh {run}
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr '+/' '-_' | tr -d '=')
```

## 5. Send the person to Odudu

The app redirects the browser to the authorization address. `state` is a value it compares when the person comes back, and `nonce` appears in the ID token.

```sh {run}
AUTHORIZE_URL="$TENANT/protocol/openid-connect/auth?response_type=code&client_id=my-spa&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback&scope=openid%20profile%20email&state=abc123&nonce=n-0S6_WzA2Mj&code_challenge=$CHALLENGE&code_challenge_method=S256" && echo "$AUTHORIZE_URL"
```

In a real app the browser opens that address, and the person signs in on Odudu's page. To keep going in the terminal, the next commands play the browser's part and sign in as `ada`.

```sh {run}
COOKIES=$(mktemp) && PAGE=$(curl -fsS -c "$COOKIES" "$AUTHORIZE_URL")
```

```sh {run}
AUTH_SESSION=$(printf '%s' "$PAGE" | sed -n 's/.*name="auth_session_id" value="\([^"]*\)".*/\1/p' | head -1)
```

```sh {run expect="http://localhost:8080/callback?code="}
CALLBACK=$(curl -sS -o /dev/null -D - -b "$COOKIES" --data-urlencode "auth_session_id=$AUTH_SESSION" --data-urlencode username=ada --data-urlencode 'password=a long and unremarkable passphrase' "$TENANT/login-actions/authenticate" | sed -n 's/^[Ll]ocation: //p' | tr -d '\r') && echo "$CALLBACK"
```

The address your app lands on carries the `code`, your `state` and the issuer. The app checks that `state` is the value it sent before it goes on.

```sh {run}
CODE=$(printf '%s' "$CALLBACK" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
```

## 6. Swap the code for tokens

The app sends the code and the verifier. There is no secret, so the request names the client instead. From a browser it would also carry the `Origin` header, which the command adds.

```sh {run expect="Bearer"}
TOKENS=$(curl -fsS -H "Origin: http://localhost:8080" --data-urlencode grant_type=authorization_code --data-urlencode "code=$CODE" --data-urlencode redirect_uri=http://localhost:8080/callback --data-urlencode client_id=my-spa --data-urlencode "code_verifier=$VERIFIER" "$TENANT/protocol/openid-connect/token") && printf '%s\n' "$TOKENS" | sed -E 's/("(access|id|refresh)_token":"[^"]{12})[^"]*"/\1…"/g'
```

The access token is what the app sends to your API. The ID token says who signed in. The refresh token gets new tokens later, and Odudu replaces it each time it is used, so a stolen one is caught. Keep all three in memory rather than in `localStorage`, where any script on the page can read them.

## Where to go next

- Keep people signed in with [Refresh and end a session](./refresh-and-end-a-session.md), which also covers signing out.
- Protect the API your app calls with [Protect an API](./api.md).
- The same flow for an app with a server, which keeps a secret, is [Sign people in to a web app](./web-app.md).
