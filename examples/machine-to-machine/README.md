# Machine-to-machine example

A service that is not a person: a nightly job, or a backend calling another backend. It signs in as itself with a secret, gets an access token, and calls the [API example](../api) with it. This example is one file, `client.ts`, and has no dependencies, because `fetch` is enough.

## What happens

1. The service sends its client id and secret to the tenant's token endpoint, in the `Authorization` header (`client_secret_basic`), and asks for the `client_credentials` grant.
2. Odudu answers with an access token that lasts five minutes. There is no refresh token and no ID token, because nobody signed in. When the token expires, the service asks again.
3. The service calls the API with the token and prints what came back.

## Run it

You need Node 24 or later, the quick start stack and the API example running. Run `../_shared/provision.sh` once, start the API with `npm ci && npm start` in `../api`, then here:

```text
npm start
```

`npm test` starts the API itself, runs the client and checks that it is answered, and checks that a wrong secret is refused.

## What is only for the example

The secret has a published default for the local stack. Read yours from the environment of the machine the service runs on.
