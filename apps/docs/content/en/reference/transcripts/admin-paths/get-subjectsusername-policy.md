---
title: 'GET /subjects/username-policy'
description: 'Requires view-users. Whether this tenant accepts a rename — its username_editable setting, alone, for whoever can read subjects: GET /settings holds…'
---

# `GET /subjects/username-policy`

Requires `view-users`. Whether this tenant accepts a rename — its
`username_editable` setting, alone, for whoever can read subjects:
[`GET /settings`](./get-settings-and-patch-settings.md) holds the same value but
needs `manage-tenant`, which an operator who manages subjects may not hold,
and a form that could not read it would have to offer the username and let
[`PATCH /subjects/:id`](./patch-subjectsid.md) refuse it. It answers no `ETag`:
nothing is written against it.

As `vera`, who holds `view-users` alone, before the disable run under "The shape
of it" above: the policy, then the settings it comes from, refused to her, then
the policy again once `$ADMIN_TOKEN` turned renaming on (`PATCH /settings` with
`{"username_editable":true}`, printing only its status):

```bash
P=http://localhost:3080/admin/tenants/policy-demo
curl -sS -H "Authorization: Bearer $VERA_TOKEN" "$P/subjects/username-policy"
curl -sS -H "Authorization: Bearer $VERA_TOKEN" "$P/settings"
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"username_editable":true}' "$P/settings" -o /dev/null -w '%{http_code}\n'
curl -sS -D - -H "Authorization: Bearer $VERA_TOKEN" "$P/subjects/username-policy"
```

```
{"username_editable":false}
{"type":"about:blank","title":"Forbidden","status":403,"instance":"01a0ed2f-677d-795d-a102-4b8fd7b8f163"}
200
HTTP/1.1 200 OK
x-request-id: 01a0ed2f-67af-7ea4-928b-e8468e49d211
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 26
Date: Tue, 29 Sep 2026 12:41:42 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"username_editable":true}
```
