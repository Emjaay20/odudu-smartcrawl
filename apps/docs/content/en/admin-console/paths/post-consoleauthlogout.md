---
title: 'POST /console/auth/logout'
description: "From the seventh run, on a second console session of ada's, signed in with its own jar and ended here, so the sections around it keep the first."
---

## `POST /console/auth/logout`

From the seventh run, on a second console session of `ada`'s, signed in with its
own `jar` and ended here, so the sections around it keep the first. Sent with no
body. The same CSRF guard applies here. `$SINCE` is the second before it:

```bash
curl -sS -D - -c jar -b jar -X POST \
  -H 'Origin: http://localhost:3082' -H 'X-Odudu-Console: 1' \
  http://localhost:3082/console/auth/logout
docker compose -p odudu-docs-12b logs --since $SINCE odudu 2>&1 \
  | sed 's/^[^{]*//' \
  | jq -c 'select(.msg == "incoming request" or .msg == "request completed") | [.reqId, .req.method // .res.statusCode, .req.url // null]'
```

```
HTTP/1.1 200 OK
x-request-id: 01a12040-dabb-7606-a68f-4dd2c7304ac6
cache-control: no-store
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/json; charset=utf-8
content-length: 713
Date: Fri, 09 Oct 2026 10:41:23 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"redirect":"http://localhost:3082/tenants/system/protocol/openid-connect/logout?id_token_hint=eyJhbGciOiJFUzI1NiIsImtpZCI6IjAxYTEyMDNhLWY4NjItN2M0OC1hMWUwLWQxODAyMmE1NjMyYiJ9.eyJzdWIiOiIwMWExMjAzYS1mODZkLTdlOGUtYTUzNy1lMzlmNWQ3N2IwNGYiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjMwODIvdGVuYW50cy9zeXN0ZW0iLCJhdWQiOiJvZHVkdS1hZG1pbiIsImlhdCI6MTc5MTU0MjQ3NiwiZXhwIjoxNzkxNTQyNzc2LCJub25jZSI6IkNUZldrOFQ1WUNwX0ppRVVNaC1vZzhkQjkwLU80NE43Rjhya3lteU1ka0EiLCJzaWQiOiIwMWExMjA0MC1jMDRkLTdlOTItOTE3Zi1hZGY3OTZiZDBlOTMiLCJhbXIiOlsicHdkIl0sImFjciI6IjEifQ.ZZbqhRp1FSFfE0hzibzxLSyCkZ1LOCBTr3b3Brq4wh6hMtaGlWQy9I5FCTWeWd8wJZS4B-VwUVl9jUma4g39Kg&post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3082%2Fconsole%2F&client_id=odudu-admin"}
```

The log, with the stack's own health probes left out. The gateway revoked the
session's refresh token at the tenant's `/revoke`, signing the assertion it
authenticates with, and the endpoint answered `200`. An unsigned revocation would
have been refused and the token left alive; [the section above](./the-gateway-is-a-confidential-client.md)
shows that refusal:

```
["01a12040-dabb-7606-a68f-4dd2c7304ac6","POST","/console/auth/logout"]
["01a12040-dabb-7606-a68f-4dd2c7304ac6","POST","/tenants/system/protocol/openid-connect/revoke"]
["01a12040-dabb-7606-a68f-4dd2c7304ac6",200,null]
["01a12040-dabb-7606-a68f-4dd2c7304ac6","GET","/tenants/system/.well-known/openid-configuration"]
["01a12040-dabb-7606-a68f-4dd2c7304ac6",200,null]
["01a12040-dabb-7606-a68f-4dd2c7304ac6",200,null]
```

By the time this answered, the gateway had revoked the session's refresh
token, deleted its `console_sessions` row and cleared its cookie. The
tenant's SSO session is still live. Only the browser's own navigation to
`redirect` carries the SSO cookie, so the SPA follows it itself.
