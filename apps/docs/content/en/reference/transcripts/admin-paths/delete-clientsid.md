---
title: 'DELETE /clients/{id}'
description: 'Requires manage-clients. Deletes the client and its OIDC configuration in one statement — the foreign key from client_oidc_config to clients…'
---

# `DELETE /clients/{id}`

Requires `manage-clients`. Deletes the client and its OIDC configuration in
one statement — the
foreign key from `client_oidc_config` to `clients` cascades, so nothing
here deletes the config row a second time. `204` with no body on success,
`404` for an id that does not exist, and the same `409` built-in-admin
guard `PATCH` uses: the built-in client cannot be deleted any more than it
can be disabled. Every role scoped to the client goes with it, so a delete
whose roles reach an admin capability the caller does not hold is refused
with `403`
([a removal is judged by what it removes](./get-groupsidroles-and-put-groupsidroles.md#a-removal-is-judged-by-what-it-removes)),
as is one whose service account holds more than the caller
([the service account's ceiling](./post-clientsidsecret.md#the-service-accounts-ceiling)).

All three outcomes against `client-facts-demo`, in that order: the built-in
client, an id nothing holds, then `demo-backend` — its secret rotated
below first, since this is the same instance the rest of this section
disabled and rotated. A `404` carries no `detail` at all, only the status
and the request id:

```bash
curl -sS -D - -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/client-facts-demo/clients/01a109b6-1dd6-7fb7-834f-b09b02db9a21
```

```
{"type":"about:blank","title":"Conflict","status":409,"detail":"odudu-admin is this tenant's built-in admin client and cannot be deleted","instance":"01a109b7-36fa-7857-a04f-02e4678ff189"}
{"type":"about:blank","title":"Not Found","status":404,"instance":"01a109b7-3711-79b9-86b4-2e4d9f437d1c"}

HTTP/1.1 204 No Content
x-request-id: 01a109b7-3725-751a-8d44-c50879a92140
cache-control: no-store
Date: Mon, 05 Oct 2026 01:39:24 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```
