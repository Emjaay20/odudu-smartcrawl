---
title: 'DELETE /keys/:id'
description: 'Requires manage-keys. Deletes a retired key, which is published nowhere and signs nothing, so nothing a relying party holds can still need it.'
---

## `DELETE /keys/:id`

Requires `manage-keys`. Deletes a retired key, which is published nowhere and
signs nothing, so nothing a relying party holds can still need it. An active
or rotating key is refused with `409` (`about:blank#key-not-retired`): `POST /keys/:id/retire` is the door
that checks what still depends on one. `If-Match` is optional; a stale one is
refused with `412`. Writes `key.delete`, naming the `kid`. An unknown key
answers `404`.

Against the tenth stack, a key staged with `POST /keys`
(`01a0ee8c-6b4e-7479-a229-78e90920c309`), retired and then deleted, then the keys
left and the key's own trail (the refusal of deleting it before it was retired is
shown with the typed refusals above):

```bash
K=01a0ee8c-6b4e-7479-a229-78e90920c309
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys/$K/retire"; echo
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys/$K"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit?resource_type=signing_key&resource_id=$K" \
  | python3 -c 'import json,sys;[print(json.dumps({k:i[k] for k in ("action","outcome","resource_id","detail")})) for i in json.load(sys.stdin)["items"]]'
```

```
{"id":"01a0ee8c-6b4e-7479-a229-78e90920c309","status":"retired","kid":"01a0ee8c-6b4e-7479-a229-78e820c93668","alg":"RS256","created_at":"2026-09-29T19:02:55.023Z","not_after":null}
HTTP/1.1 204 No Content
x-request-id: 01a0ee8c-6c76-7042-bd64-41005d2f2b33
cache-control: no-store
Date: Tue, 29 Sep 2026 19:02:55 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0ee8a-c3c8-750a-8d55-6ba394c1e76e","status":"active","kid":"01a0ee8a-c3c7-7eea-9175-adeee2ccc815","alg":"ES256","created_at":"2026-09-29T19:01:06.581Z","not_after":null}]}
{"action": "key.delete", "outcome": "allowed", "resource_id": "01a0ee8c-6b4e-7479-a229-78e90920c309", "detail": {"kid": "01a0ee8c-6b4e-7479-a229-78e820c93668"}}
{"action": "key.retire", "outcome": "allowed", "resource_id": "01a0ee8c-6b4e-7479-a229-78e90920c309", "detail": {}}
{"action": "key.create", "outcome": "allowed", "resource_id": "01a0ee8c-6b4e-7479-a229-78e90920c309", "detail": {}}
```
