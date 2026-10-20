---
title: Call an API as a service
description: Register a service, get an access token for it with the client credentials grant and read what it holds, with commands you can run.
sidebar_position: 8
---

# Call an API as a service

Some callers are not people: a nightly job, a backend that calls another backend. They sign in as themselves, with a secret, and get a token that stands for the service. You will register a service, get a token and read it.

You need the stack from the [quick start](../quick-start/index.md) with its `demo` tenant. Run the commands in the folder that holds `compose.yaml`, in bash or zsh, with `curl` and `openssl` installed.

## 1. Point the commands at your server

If you moved the port in the quick start, use that address instead of 3000.

```sh {run}
export ODUDU_BASE="${ODUDU_BASE:-http://localhost:3000}" && export TENANT="$ODUDU_BASE/tenants/demo"
```

## 2. Register the service

Make a secret. It is the service's password, so keep it where only the service can read it.

```sh {run}
SERVICE_SECRET=$(openssl rand -hex 24)
```

Register `my-service`. Naming only the `client_credentials` grant tells Odudu this client has no sign-in page, so it needs no redirect address.

```sh {run expect="clientDbId"}
docker compose exec odudu odudu seed client --tenant demo --client-id my-service --client-secret "$SERVICE_SECRET" --grant-type client_credentials
```

## 3. Get a token

The service sends its name and secret to the token endpoint. `curl -u` puts them in the `Authorization` header.

```sh {run expect="Bearer"}
RESPONSE=$(curl -fsS -u "my-service:$SERVICE_SECRET" --data-urlencode grant_type=client_credentials "$TENANT/protocol/openid-connect/token") && printf '%s\n' "$RESPONSE" | sed -E 's/("access_token":"[^"]{12})[^"]*"/\1…"/'
```

You get an access token that lasts five minutes. There is no refresh token and no ID token, and that is by design. A refresh token exists so a person does not have to sign in again, and an ID token says that a person signed in. Here nobody did. When the token expires the service asks again with the credentials it already holds.

## 4. Read the token

A token is a signed document, and its middle part says what it is for. This helper decodes it.

```sh {run}
decode() { local p; p=$(printf '%s' "$1" | cut -d. -f2 | tr '_-' '/+'); while [ $(( ${#p} % 4 )) -ne 0 ]; do p="$p="; done; printf '%s' "$p" | openssl base64 -d -A; echo; }
```

```sh {run expect="my-service"}
TOKEN=$(printf '%s' "$RESPONSE" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p') && decode "$TOKEN"
```

`sub` is the service's own account, not any person's. `client_id` names the service, `iss` is the tenant that issued the token, and `exp` is when it stops working.

## 5. Call your API with it

The service sends the token in the `Authorization` header. This is the shape of the call. The address is yours.

```text
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/reports
```

What your API does with the token is [Protect an API](./api.md).

## 6. Know what a refusal looks like

A service gets a clear refusal when it asks for more than it was given. This one asks for the `openid` scope, which a new service is not allowed.

```sh {run expect="invalid_scope"}
curl -sS -u "my-service:$SERVICE_SECRET" --data-urlencode grant_type=client_credentials --data-urlencode scope=openid "$TENANT/protocol/openid-connect/token"
```

And this one has the wrong secret.

```sh {run expect="invalid_client"}
curl -sS -u "my-service:not-the-secret" --data-urlencode grant_type=client_credentials "$TENANT/protocol/openid-connect/token"
```

[Read a refusal](./read-a-refusal.md) explains the errors Odudu returns and what to do about each.

## Where to go next

- A service that acts for a person, rather than as itself, uses [token exchange](../reference/transcripts/request-paths/path-d-token-exchange.md).
- Every header of the request above is in [Path C: client credentials](../reference/transcripts/request-paths/path-c-client_credentials.md).
