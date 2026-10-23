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
x-request-id: 01a0e72e-5492-7d1e-9398-de4367265c35
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 97
Date: Mon, 28 Sep 2026 08:42:48 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"tenant":"console-paths","subject_id":"01a0e72d-5ba9-78cd-b877-7ea6d4076028","username":"grace"}
```
