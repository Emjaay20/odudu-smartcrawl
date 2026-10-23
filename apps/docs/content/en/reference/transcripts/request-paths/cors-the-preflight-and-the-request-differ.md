---
title: 'CORS: the preflight and the request differ'
description: 'A browser single-page client is the reader ## Path A above walks through, and until this section landed its preflight failed: /token and /userinfo…'
---

# CORS: the preflight and the request differ

A browser single-page client is the reader `## Path A` above walks through,
and until this section landed its preflight failed: `/token` and
`/userinfo` sent no `Access-Control-Allow-Origin` at all, so the browser
never let the page see the response. A preflight (`OPTIONS`) carries no
client identity — no body, no `Authorization` header, only `Origin`,
`Access-Control-Request-Method` and `Access-Control-Request-Headers` — so it
is answered from the **tenant's union** of every client's registered
`web_origins`. The real request that follows is answered from **that one
client's own** origins, resolved once the request names which client it is:
`client_id` in the form body at `/token`, the `client_id` claim of the
bearer token at `/userinfo`. An origin the preflight allowed because it
belongs to a different client in the same tenant is, correctly, withheld on
the real request — no status code or body changes, the header is just
absent, and the browser discards the response on its own.

The tenant's union is one index probe, not a read of every client: the
server keeps a `client_origins` row for each `web_origins` entry (and each
`redirect_uris` origin, where `+` asks for them) whenever it writes those lists,
with the same normaliser the request side uses, so the preflight asks whether
one origin is registered and a tenant with ten thousand clients pays what a
tenant with one does. A list edited in SQL empties that client's rows, so the
origin is refused until the client is amended through the server (`PATCH`, or
`seed client --web-origin`), never left allowed after it was removed.

`/certs` and `/.well-known/openid-configuration` are unauthenticated public
documents: every origin gets `Access-Control-Allow-Origin: *` and no `Vary`.
`/authorize` and `/login-actions/*` are top-level navigations and get no
CORS treatment of any kind — a header there would hand a script read access
to the login page.

The origins are registered through the server, which is what keeps the
preflight's table in step with them: `demo-spa` and `other-app` with `odudu
seed client --public --web-origin`, and `spa-with-user`, created by the
bootstrap `seed` form that carries no such flag, with a `PATCH` of its
`web_origins` through the admin API. (An `UPDATE` in `psql` would empty a
client's origins, not add one.) The tenant is `cors-demo`, on a stack of its
own listening on port 3092, so the URLs below say `localhost:3092`; its
clients are `demo-spa` at `https://demo-spa.example`, `other-app` at
`https://other-app.example`, and `spa-with-user` — also at
`https://demo-spa.example` — carrying the user `ada` that signs in below.
Headers that differ on every run (`x-request-id`, `date`, `connection`,
`keep-alive`) are left out of each response.

```bash
odudu seed tenant --name cors-demo
odudu seed client --tenant cors-demo --client-id demo-spa --public \
  --redirect-uri http://localhost:8080/callback --web-origin https://demo-spa.example
odudu seed client --tenant cors-demo --client-id other-app --public \
  --redirect-uri http://localhost:8080/callback --web-origin https://other-app.example
odudu seed --tenant cors-demo --client spa-with-user \
  --redirect-uri http://localhost:8080/callback \
  --user ada --password correct-horse-battery --email ada@example.com
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "If-Match: $ETAG" \
  -H 'content-type: application/json' -d '{"web_origins":["https://demo-spa.example"]}' \
  http://localhost:3092/admin/tenants/cors-demo/clients/$SPA_WITH_USER_ID
```

What that left, read with `psql` (the precondition of every answer below):

```bash
psql -c "select c.client_id, o.origin from client_origins o join clients c on c.id = o.client_id order by 1"
```

```
   client_id   |          origin
---------------+---------------------------
 demo-spa      | https://demo-spa.example
 other-app     | https://other-app.example
 spa-with-user | https://demo-spa.example
(3 rows)
```

A preflight for `/token`, from an origin that belongs to `other-app`, not to
the client the real request below will name:

```bash
curl -sS -D - -o /dev/null -X OPTIONS \
  http://localhost:3092/tenants/cors-demo/protocol/openid-connect/token \
  -H "Origin: https://other-app.example" \
  -H "Access-Control-Request-Method: POST"
```

```
HTTP/1.1 204 No Content
vary: Origin
access-control-allow-origin: https://other-app.example
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: authorization, content-type
access-control-max-age: 600
content-length: 0
```

The real request, same origin, naming `demo-spa` instead — whose own
origins do not include `other-app.example` — refused a bad refresh token
exactly as it would with no `Origin` header at all, and the CORS header is
simply absent from a response that is otherwise unchanged:

```bash
curl -sS -D - -o /dev/null -X POST \
  http://localhost:3197/tenants/cors-demo/protocol/openid-connect/token \
  -H "Origin: https://other-app.example" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=refresh_token&refresh_token=bogus&client_id=demo-spa" \
  | tr -d '\r' | grep -vE '^(x-request-id|Date|Connection|Keep-Alive):|^$'
```

```
HTTP/1.1 400 Bad Request
vary: Origin
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8
content-length: 79
```

(`access-control-allow-origin` does not appear in that response at all —
`vary: Origin` does, on every response from this endpoint, allowed or not,
so a shared cache never serves one origin's answer to another.) The same
request with `Origin: https://demo-spa.example` — `demo-spa`'s own origin —
gets the header back, still a 400 for the same bogus refresh token:

```bash
curl -sS -D - -o /dev/null -X POST \
  http://localhost:3197/tenants/cors-demo/protocol/openid-connect/token \
  -H "Origin: https://demo-spa.example" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=refresh_token&refresh_token=bogus&client_id=demo-spa" \
  | tr -d '\r' | grep -vE '^(x-request-id|Date|Connection|Keep-Alive):|^$'
```

```
HTTP/1.1 400 Bad Request
vary: Origin
access-control-allow-origin: https://demo-spa.example
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8
content-length: 79
```

`/userinfo` takes the same split from the other side: the client comes from
the access token's `client_id` claim rather than a body parameter. Signing
in as `spa-with-user` and calling `/userinfo` with its own origin gets the
header; with `other-app`'s origin, the same 200 with the same claims, and no
header:

```bash
curl -sS -D - -o /dev/null \
  http://localhost:3092/tenants/cors-demo/protocol/openid-connect/userinfo \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Origin: https://demo-spa.example"
curl -sS -D - -o /dev/null \
  http://localhost:3092/tenants/cors-demo/protocol/openid-connect/userinfo \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Origin: https://other-app.example"
```

```
HTTP/1.1 200 OK
vary: Origin
access-control-allow-origin: https://demo-spa.example
content-type: application/json; charset=utf-8
content-length: 135
```

```
HTTP/1.1 200 OK
vary: Origin
content-type: application/json; charset=utf-8
content-length: 135
```

The two public documents, from an origin nothing registered:

```bash
curl -sS -D - -o /dev/null \
  http://localhost:3092/tenants/cors-demo/protocol/openid-connect/certs \
  -H "Origin: https://anything.example"
curl -sS -D - -o /dev/null \
  http://localhost:3092/tenants/cors-demo/.well-known/openid-configuration \
  -H "Origin: https://anything.example"
```

```
HTTP/1.1 200 OK
access-control-allow-origin: *
content-type: application/json; charset=utf-8
content-length: 455
```

```
HTTP/1.1 200 OK
access-control-allow-origin: *
content-type: application/json; charset=utf-8
content-length: 2300
```

(no `Vary` on either — a fixed wildcard has nothing to vary the response
on). And `/authorize`, which gets nothing:

```bash
curl -sS -D - -o /dev/null -X OPTIONS \
  http://localhost:3092/tenants/cors-demo/protocol/openid-connect/auth \
  -H "Origin: https://other-app.example" \
  -H "Access-Control-Request-Method: GET"
```

```
HTTP/1.1 404 Not Found
vary: Origin
content-type: application/problem+json; charset=utf-8
```

No `access-control-allow-origin` — the browser gets nothing to read this
response with. The `Vary: Origin` here is a side effect of `@fastify/cors`
answering every unmatched `OPTIONS` request from one global fallback route
regardless of which encapsulated scope registered it; it is harmless — nothing
downstream keys a cache entry on it — but it is not hidden here as something it
is not.
