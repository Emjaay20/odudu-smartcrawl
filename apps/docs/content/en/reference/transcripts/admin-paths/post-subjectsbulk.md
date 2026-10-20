---
title: 'POST /subjects/bulk'
description: 'Requires manage-users. Applies one action to at most 100 subjects: disable, enable, delete, or end-sessions, which additionally requires…'
---

# `POST /subjects/bulk`

Requires `manage-users`. Applies one action to at most 100 subjects:
`disable`, `enable`, `delete`, or `end-sessions`, which additionally requires
`manage-sessions` and is refused whole with `403` without it. Each id goes
through the single-subject door exactly — `PATCH /subjects/:id` with
`{"enabled": …}`, `DELETE /subjects/:id`, `DELETE /subjects/:id/sessions` —
in a transaction of its own, so its target ceiling, its last-administrator
guard and its audit row apply to it alone, and one refused id leaves the
others as they were. The answer is `200` with one item per distinct id, in
the order given: the status that door would have answered, and a refusal's
problem `type` and `detail`; `end-sessions` adds how many were `ended`. More
than 100 ids, none, an id that is not a UUID or an action not in the list is
refused with `400`.

Against the tenth stack, as `uma`, a subject seeded in `ops-demo` and granted
`odudu-admin:manage-users` alone (`$UMA_TOKEN`), after `temp-1`
(`01a0ee8c-67c6-7752-904b-584bbc614619`) and `temp-2`
(`01a0ee8c-67ea-7049-b5d2-57c68046736c`) were created through
`POST /subjects`: a disable of `temp-1`, of `mona`, who holds
`manage-tenant`, and of an id no subject holds; `end-sessions` without
`manage-sessions`; then a delete by `$ADMIN_TOKEN`, and the rows the first
request left, each naming its id:

```bash
curl -sS -X POST -H "Authorization: Bearer $UMA_TOKEN" -H 'content-type: application/json' \
  -d '{"action":"disable","ids":["01a0ee8c-67c6-7752-904b-584bbc614619","01a0ee8a-c8f6-7450-b486-861a66a87684","0199aa00-0000-7000-8000-0000000000ff"]}' \
  "$P/subjects/bulk"; echo
curl -sS -X POST -H "Authorization: Bearer $UMA_TOKEN" -H 'content-type: application/json' \
  -d '{"action":"end-sessions","ids":["01a0ee8c-67c6-7752-904b-584bbc614619"]}' \
  "$P/subjects/bulk"; echo
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"action":"delete","ids":["01a0ee8c-67c6-7752-904b-584bbc614619","01a0ee8c-67ea-7049-b5d2-57c68046736c"]}' \
  "$P/subjects/bulk"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit/count?action=subject.delete"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit?action=subject.amend&limit=2" \
  | python3 -c 'import json,sys;[print(json.dumps({k:i[k] for k in ("action","outcome","actor_name","resource_id","detail")})) for i in json.load(sys.stdin)["items"]]'
```

```
{"items":[{"id":"01a0ee8c-67c6-7752-904b-584bbc614619","status":204},{"id":"01a0ee8a-c8f6-7450-b486-861a66a87684","status":403,"type":"about:blank","detail":"the subject holds what the caller does not: manage-tenant"},{"id":"0199aa00-0000-7000-8000-0000000000ff","status":404,"type":"about:blank","detail":"no subject 0199aa00-0000-7000-8000-0000000000ff"}]}
{"type":"about:blank","title":"Forbidden","status":403,"instance":"01a0ee8c-69e5-74a5-bb6e-e50bd8569a6b"}
{"items":[{"id":"01a0ee8c-67c6-7752-904b-584bbc614619","status":204},{"id":"01a0ee8c-67ea-7049-b5d2-57c68046736c","status":204}]}
{"count":2,"capped":false}
{"action": "subject.amend", "outcome": "refused", "actor_name": "uma", "resource_id": "01a0ee8a-c8f6-7450-b486-861a66a87684", "detail": {"denied": ["manage-tenant"]}}
{"action": "subject.amend", "outcome": "allowed", "actor_name": "uma", "resource_id": "01a0ee8c-67c6-7752-904b-584bbc614619", "detail": {"enabled": {"after": false, "before": true}}}
```
