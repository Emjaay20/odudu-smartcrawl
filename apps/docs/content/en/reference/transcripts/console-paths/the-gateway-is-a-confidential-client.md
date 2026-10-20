---
title: 'The gateway is a confidential client'
description: "The gateway signs an RFC 7523 assertion with the console's key for the code exchange, the refresh and the revocation; without one they are refused."
---

# The gateway is a confidential client

The callback above exchanges the code it was given at the tenant's token
endpoint, and `odudu-admin`, the client it does so as, is confidential: that
exchange carries an RFC 7523 assertion signed with the console's key, and so do
the refresh and the revocation. The sign-in is as the first run showed it, `ada`
through the tenant's form with no password change owed this time; the callback,
and the server's request log for that second, which names the call the gateway
made in between (`$SINCE` is the second before it):

```bash
curl -sS -D - -c jar -b jar "$LOCATION"
docker compose -p odudu-docs-12b logs --since $SINCE odudu 2>&1 \
  | sed 's/^[^{]*//' \
  | jq -c 'select(.msg == "incoming request" or .msg == "request completed") | [.reqId, .req.method // .res.statusCode, .req.url // null]'
```

```
HTTP/1.1 302 Found
x-request-id: 01a1203f-07e2-7fbe-a009-7453e2a8df37
cache-control: no-store
set-cookie: odudu-console-login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console-restart=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
set-cookie: odudu-console=0199aa00-0000-7000-8000-000000000001.2HS33GTmBoQ1jBz_2vnrBYoDiCG5YsvoCenMz3_RESY; HttpOnly; SameSite=Strict; Path=/
location: /console/
content-length: 0
Date: Fri, 09 Oct 2026 10:39:24 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The log, filtered to the callback's own request id. The `POST` is the
exchange, and it was answered `200`:

```
["01a1203f-07e2-7fbe-a009-7453e2a8df37","GET","/console/auth/callback"]
["01a1203f-07e2-7fbe-a009-7453e2a8df37","GET","/tenants/system/.well-known/openid-configuration"]
["01a1203f-07e2-7fbe-a009-7453e2a8df37",200,null]
["01a1203f-07e2-7fbe-a009-7453e2a8df37","POST","/tenants/system/protocol/openid-connect/token"]
["01a1203f-07e2-7fbe-a009-7453e2a8df37",200,null]
["01a1203f-07e2-7fbe-a009-7453e2a8df37","GET","/tenants/system/protocol/openid-connect/certs"]
["01a1203f-07e2-7fbe-a009-7453e2a8df37",200,null]
["01a1203f-07e2-7fbe-a009-7453e2a8df37",302,null]
```

What the assertion buys is what the same calls are without it. The loopback
client's session at `system` left a refresh token from the first sign-in
("Getting the token" in the admin paths shows it), `$R1`, and `console
assertion` prints a signed assertion. The refresh and the revocation, each
without one, are refused, and a refusal spends nothing:

```bash
curl -sS -D - --data-urlencode grant_type=refresh_token --data-urlencode "refresh_token=$R1" \
  --data-urlencode client_id=odudu-admin \
  http://localhost:3082/tenants/system/protocol/openid-connect/token
curl -sS -D - --data-urlencode "token=$R1" --data-urlencode token_type_hint=refresh_token \
  --data-urlencode client_id=odudu-admin \
  http://localhost:3082/tenants/system/protocol/openid-connect/revoke
```

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a1203f-2ea5-71cf-aa0d-fdf882ed4b46
vary: Origin
www-authenticate: Basic realm="token"
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8
content-length: 26
Date: Fri, 09 Oct 2026 10:39:34 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"error":"invalid_client"}
```

```
HTTP/1.1 401 Unauthorized
x-request-id: 01a1203f-2edf-7f31-a75b-6c9933dc1f23
www-authenticate: Basic realm="token"
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 26
Date: Fri, 09 Oct 2026 10:39:34 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"error":"invalid_client"}
```

With an assertion, signed for the endpoint's own tenant and presented once,
the refresh answers and rotates the token. The `ASSERTION` is printed by the
`odudu` container, as the operator holds the key:

```bash
ASSERTION=$(docker compose -p odudu-docs-12b exec -T odudu node dist/main.js console assertion --tenant system)
curl -sS -D - --data-urlencode grant_type=refresh_token --data-urlencode "refresh_token=$R1" \
  --data-urlencode client_id=odudu-admin \
  --data-urlencode client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer \
  --data-urlencode "client_assertion=$ASSERTION" \
  http://localhost:3082/tenants/system/protocol/openid-connect/token
```

```
HTTP/1.1 200 OK
x-request-id: 01a1203f-33b1-7a72-bf9c-227d94e20c5e
vary: Origin
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8
content-length: 837
Date: Fri, 09 Oct 2026 10:39:35 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"access_token":"eyJhbGciOiJFUzI1NiIsImtp…","refresh_token":"AG63NELqKwsz9hxTTAfClb0a…","token_type":"Bearer","expires_in":300,"scope":"openid"}
```

(The tokens are cut to their first 24 characters, as in "Getting the token".) A
revocation presents the rotated token, `$R2`, the same way, and the refresh that
follows is refused for a grant that is gone, not for the client that asked:

```bash
curl -sS -D - --data-urlencode "token=$R2" --data-urlencode token_type_hint=refresh_token \
  --data-urlencode client_id=odudu-admin \
  --data-urlencode client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer \
  --data-urlencode "client_assertion=$(docker compose -p odudu-docs-12b exec -T odudu node dist/main.js console assertion --tenant system)" \
  http://localhost:3082/tenants/system/protocol/openid-connect/revoke
curl -sS -D - --data-urlencode grant_type=refresh_token --data-urlencode "refresh_token=$R2" \
  --data-urlencode client_id=odudu-admin \
  --data-urlencode client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer \
  --data-urlencode "client_assertion=$(docker compose -p odudu-docs-12b exec -T odudu node dist/main.js console assertion --tenant system)" \
  http://localhost:3082/tenants/system/protocol/openid-connect/token
```

```
HTTP/1.1 200 OK
x-request-id: 01a1203f-4c3f-7fc0-80b1-e201cbf46442
cache-control: no-store
content-length: 0
Date: Fri, 09 Oct 2026 10:39:41 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a1203f-4e6b-734a-aacc-5d3bbe1072fe
vary: Origin
cache-control: no-store
pragma: no-cache
content-type: application/json; charset=utf-8
content-length: 25
Date: Fri, 09 Oct 2026 10:39:42 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"error":"invalid_grant"}
```

An assertion is good once. The same one presented twice at `/revoke`, the
status of each:

```bash
A=$(docker compose -p odudu-docs-12b exec -T odudu node dist/main.js console assertion --tenant system)
for i in 1 2; do
  curl -sS -o /dev/null -w "%{http_code} " --data-urlencode token=x --data-urlencode client_id=odudu-admin \
    --data-urlencode client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer \
    --data-urlencode "client_assertion=$A" \
    http://localhost:3082/tenants/system/protocol/openid-connect/revoke
done
```

```
200 401
```
