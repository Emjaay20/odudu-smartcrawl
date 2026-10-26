---
title: 'GET /admin/openapi.json'
description: 'The reference these pages point at: an OpenAPI 3.1 description of every route above, generated from the same route table the router registers…'
---

# `GET /admin/openapi.json`

The reference these pages point at: an OpenAPI 3.1 description of every route
above, generated from the same route table the router registers from, so the two
cannot drift. It takes no `{tenant}` — it describes the API rather than reaching
into one — and is served without authentication, since a client that cannot read
it cannot generate against it.

```bash
curl -sS -D - -o openapi.json http://localhost:3197/admin/openapi.json
jq '.paths | length' openapi.json
```

```
HTTP/1.1 200 OK
x-request-id: 01a17a67-7def-705f-8152-6f83b8eaf326
access-control-allow-origin: *
content-type: application/json; charset=utf-8
content-length: 432699
Date: Mon, 26 Oct 2026 22:49:25 GMT
Connection: keep-alive
Keep-Alive: timeout=72

78
```

423 KB and 78 paths, which is the whole route table. It is the one admin
response readable from any origin, so a viewer served from another port can load
it — the local stack's optional Swagger UI does exactly that (see [Browsing the
admin API](../../../contributing/run-from-a-checkout.md)). No admin route carries that header, so a page on
another origin can read the description but cannot call the API with it. Its
first bytes, and the `bearerAuth` scheme it declares — `head -c 180
openapi.json` and the substring at `securitySchemes`:

```
{"openapi":"3.1.0","info":{"title":"Odudu admin API","version":"0.0.0"},"security":[{"bearerAuth":[]}],"paths":{"/admin/tenants/{tenant}/whoami":{"get":{"summary":"Requires an auth
```

```
"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT","description":"An access token whose \"aud\" claim names urn:odudu:params:admin-api. A token minted for another audience, including the protocol surface itself, is refused with 401."}}
```

`security` is declared once at the top level, so every path inherits it
rather than repeating it. `/admin/openapi.json` is not among those 78
paths: the document does not describe itself, which is why serving it
unauthenticated does not contradict the blanket `security` above.

Each operation also carries its `requestBody`, generated from the same body
schema the router validates a request against, and its query parameters,
generated from the same querystring schema — before, the document declared
neither, so a generated client had the path and the response shape but not
what to send.
