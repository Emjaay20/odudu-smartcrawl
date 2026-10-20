---
title: 'GET /console/auth/login'
description: "The console's sign-in starts here. return_to is where the callback sends the browser afterwards, and must be a /console/ path."
---

# `GET /console/auth/login`

The console's sign-in starts here. `return_to` is where the callback sends
the browser afterwards, and must be a `/console/` path.

```bash
curl -sS -D - -c jar -b jar \
  'http://localhost:3000/console/auth/login?tenant=console-paths&return_to=/console/x'
```

```
HTTP/1.1 302 Found
x-request-id: 01a0e72d-ea04-7282-8dc9-3af273010688
cache-control: no-store
set-cookie: odudu-console-login=01a0e72d-5927-73c3-b14d-a5b60d1ca9ad.QX8ZO1RY_J1MdKom93WTJYF874v-TWgyQF-9GWMpJf8; HttpOnly; SameSite=Lax; Path=/; Max-Age=600
location: http://localhost:3000/tenants/console-paths/protocol/openid-connect/auth?response_type=code&client_id=odudu-admin&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fconsole%2Fauth%2Fcallback&scope=openid&resource=urn%3Aodudu%3Aparams%3Aadmin-api&state=01a0e72d-5927-73c3-b14d-a5b60d1ca9ad.QX8ZO1RY_J1MdKom93WTJYF874v-TWgyQF-9GWMpJf8&nonce=Iu7RcG35u2Acqx5ZYXRj50xMj9Z-5JLRekmu_Gl7xu4&code_challenge=85kIqtAnRk5vtMhBLPO1ESw8ZT3LFu2lpM_DyBsf9Ik&code_challenge_method=S256
content-length: 0
Date: Mon, 28 Sep 2026 08:42:21 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The login cookie's value is the `state` sent to the authorization endpoint:
`<tenant id>.<secret>`. The pending sign-in is stored with the secret's
hash, the PKCE verifier and the nonce. It lasted 600 seconds when this run
was captured, as the cookie's `Max-Age` says, and every login cookie below
says the same. It lasts 1800 seconds now — as long as the tenant's own
sign-in lasts by default (`login_ttl_seconds`), since that is where the time
goes. The same request on **a sixth run**, on a stack of its own, the
project `odudu-t10` on `http://localhost:3082` at `511db0fd`, in a tenant
`reach-demo` made there with `odudu seed tenant`, after the change:

```bash
curl -sS -D - -c jar -b jar \
  'http://localhost:3082/console/auth/login?tenant=reach-demo&return_to=/console/x'
```

```
HTTP/1.1 302 Found
x-request-id: 01a10b70-ca94-750f-8ee9-f5fe252bfd43
cache-control: no-store
set-cookie: odudu-console-login=01a10b4d-ca70-77b4-b690-4c149c9775eb.4RfyPlgrm1a6I2t_qGwFXpyZbQIhhuZB7hlG0YiYvas; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800
location: http://localhost:3082/tenants/reach-demo/protocol/openid-connect/auth?response_type=code&client_id=odudu-admin&redirect_uri=http%3A%2F%2Flocalhost%3A3082%2Fconsole%2Fauth%2Fcallback&scope=openid&resource=urn%3Aodudu%3Aparams%3Aadmin-api&state=01a10b4d-ca70-77b4-b690-4c149c9775eb.4RfyPlgrm1a6I2t_qGwFXpyZbQIhhuZB7hlG0YiYvas&nonce=7XpTun4XRrP3iXuSYuc-0TQw1-NF8dFAs64w4am1HCM&code_challenge=u10his0Q0sYMd8ssYQj0QsRM4Owk0QhwsAGJHHuFUzk&code_challenge_method=S256
content-length: 0
Date: Mon, 05 Oct 2026 09:41:43 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The sections below go on from the first run's `location`, not this one's.
