# API example

An API that decides, on its own, whether to trust the access token a caller sends. It does not ask Odudu on each request. This example is one file, `server.ts`, and one dependency, [`jose`](https://github.com/panva/jose).

## What it checks

For `GET /reports`, in this order:

1. The token's signature, against the tenant's published keys. The keys are fetched once, kept, and fetched again when a token names a key the API does not know.
2. The issuer is the tenant you trust, exactly.
3. The audience is this API. Odudu names the tenant itself unless a client says otherwise; set `API_AUDIENCE` to change what this API accepts.
4. The token is an access token. An ID token is signed with the same keys, so the check on its type is what keeps it out.
5. The token has not expired.

Anything else is a `401`, and the body says only `invalid_token`.

## Run it

You need Node 24 or later and the quick start stack. Run `../_shared/provision.sh` once, then:

```text
npm ci
npm start
```

Get a token the way [`../machine-to-machine`](../machine-to-machine) does and call `http://localhost:8082/reports` with it. `npm test` does that, and also calls with no token, with a token for another audience, with an ID token and with an expired token.

## What is only for the example

The API listens on plain http; a production API sits behind HTTPS. It does not check the token's scope, which an API that serves more than one kind of caller would.
