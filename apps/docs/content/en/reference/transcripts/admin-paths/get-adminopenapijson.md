---
title: 'GET /admin/openapi.json'
description: 'The reference this document points at: an OpenAPI 3.1 description of every route above, generated from the same route table the router registers…'
---

# `GET /admin/openapi.json`

The reference this document points at: an OpenAPI 3.1 description of every
route above, generated from the same route table the router registers from,
so the two cannot drift. It takes no `{tenant}` — it describes the API
rather than reaching into one — and is served without authentication, since
a client that cannot read it cannot generate against it. Captured again at the close of P4d, against a stack of its own — the
project `odudu-fix18b` on `http://localhost:3187`, built from the tree at
`126ad3b7` on an empty volume:

```bash
curl -sS -D - -o openapi.json http://localhost:3187/admin/openapi.json
jq '.paths | length' openapi.json
```

```
HTTP/1.1 200 OK
x-request-id: 01a140be-1aa4-7732-9373-b578e205487c
access-control-allow-origin: *
content-type: application/json; charset=utf-8
content-length: 326972
Date: Thu, 15 Oct 2026 18:06:02 GMT
Connection: keep-alive
Keep-Alive: timeout=72

75
```

319 KB and 75 paths, which is the whole route table. It is the one admin
response readable from any origin, so a viewer served from another port can
load it — the local stack's optional Swagger UI does exactly that (see
`README.md`, "Browsing the admin API"). No admin route carries that header,
so a page on another origin can read the description but cannot call the
API with it. Its first bytes, and
the `bearerAuth` scheme it declares — `head -c 180 openapi.json` and the
substring at `securitySchemes`:

```
{"openapi":"3.1.0","info":{"title":"Odudu admin API","version":"0.0.0"},"security":[{"bearerAuth":[]}],"paths":{"/admin/tenants/{tenant}/whoami":{"get":{"summary":"Requires an auth
```

```
"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT","description":"An access token whose \"aud\" claim names urn:odudu:params:admin-api. A token minted for another audience, including the protocol surface itself, is refused with 401."}}
```

`security` is declared once at the top level, so every path inherits it
rather than repeating it. `/admin/openapi.json` is not among those 75
paths: the document does not describe itself, which is why serving it
unauthenticated does not contradict the blanket `security` above.

Each operation also carries its `requestBody`, generated from the same body
schema the router validates a request against, and its query parameters,
generated from the same querystring schema — before, the document declared
neither, so a generated client had the path and the response shape but not
what to send.
