---
title: 'POST /console/auth/logout'
description: 'A console logout ends the console session. It is sent with no body, under the same CSRF guard as every other write.'
---

# `POST /console/auth/logout`

On a second console session of `ada`'s, signed in with its own `jar` and ended
here, so the sections around it keep the first. Sent with no body. The same CSRF
guard applies here. `$SINCE` is the second before it:

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
x-request-id: 01a17b06-3817-7f4e-955d-e946468cd377
cache-control: no-store
set-cookie: odudu-console=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
content-type: application/json; charset=utf-8
content-length: 713
Date: Tue, 27 Oct 2026 01:42:47 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"redirect":"http://localhost:3082/tenants/system/protocol/openid-connect/logout?id_token_hint=eyJhbGciOiJFUzI1NiIsImtpZCI6IjAxYTE3YjA0LWJkZTctNzJhYi05ZTQ1LWMyNTRlOWNiYzg0NiJ9.eyJzdWIiOiIwMWExN2IwNC1iZGViLTdiNzMtYTVhNC1hNTY3NDAzMmFmMTUiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjM3MDEvdGVuYW50cy9zeXN0ZW0iLCJhdWQiOiJvZHVkdS1hZG1pbiIsImlhdCI6MTc5MzA2NTM2NywiZXhwIjoxNzkzMDY1NjY3LCJub25jZSI6InpYVkNtWlIyTWQwU1QyYjE2aExFdHlZYl9lWTJZcFVWcUFPcnVIdW0zZ1kiLCJzaWQiOiIwMWExN2IwNi0zNmM3LTczMGMtYTMwYS04Zjg1MWM1YzRlNzAiLCJhbXIiOlsicHdkIl0sImFjciI6IjEifQ.GZH4qYu-hmJjig8XLuwgNOVtLB7bfkbsDJraVTEikI-SOcek61wpMMQ_uToiN-H80KCttAm35-WXvDyKY_T44w&post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3082%2Fconsole%2F&client_id=odudu-admin"}
```

The log, with the stack's own health probes left out. The gateway revoked the
session's refresh token at the tenant's `/revoke`, signing the assertion it
authenticates with, and the endpoint answered `200`. An unsigned revocation would
have been refused and the token left alive; [the section above](./the-gateway-is-a-confidential-client.md)
shows that refusal:

```
["01a17b06-3817-7f4e-955d-e946468cd377","POST","/console/auth/logout"]
["01a17b06-3817-7f4e-955d-e946468cd377","POST","/tenants/system/protocol/openid-connect/revoke"]
["01a17b06-3817-7f4e-955d-e946468cd377",200,null]
["01a17b06-3817-7f4e-955d-e946468cd377","GET","/tenants/system/.well-known/openid-configuration"]
["01a17b06-3817-7f4e-955d-e946468cd377",200,null]
["01a17b06-3817-7f4e-955d-e946468cd377",200,null]
```

By the time this answered, the gateway had revoked the session's refresh
token, deleted its `console_sessions` row and cleared its cookie. The
tenant's SSO session is still live. Only the browser's own navigation to
`redirect` carries the SSO cookie, so the SPA follows it itself, and the tenant's
logout endpoint then asks the person to confirm before it ends that session
([next](./following-the-logout-redirect.md)). This request was run again on a
fresh stack at `http://localhost:3191` after that change and
answered the same `200` with a `redirect` of the same shape (`content-length: 713`).
