---
title: 'GET /console/api/session'
description: 'The console session endpoint answers with the tenant, subject and username of the signed-in administrator, and no token.'
---

# `GET /console/api/session`

```bash
curl -sS -D - -c jar -b jar http://localhost:3000/console/api/session
```

```
HTTP/1.1 200 OK
x-request-id: 01a17b02-dfdd-7f04-a1a9-78310e945b48
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 97
Date: Tue, 27 Oct 2026 01:39:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"tenant":"console-paths","subject_id":"01a17b02-1cb3-720a-ab9c-a0cc44e107a2","username":"grace"}
```
