---
title: 'GET /audit/count and GET /audit/export'
description: "Requires view-audit. Both take GET /audit's filters, and the same refusals of them."
---

# `GET /audit/count` and `GET /audit/export`

Requires `view-audit`. Both take `GET /audit`'s filters, and the same refusals
of them. `/count` answers how many rows the listing would page through, capped
like every other count. `/export` answers every row the listing would, newest
first, as NDJSON (`application/x-ndjson`), one `GET /audit` item per line —
or, past 10,000 rows, refuses the whole export with `413`
(`about:blank#export-too-large`) rather than cut it short, which would read as
the whole trail. Each export is itself audited as `audit.export`, since it
hands the trail over in bulk.

The two rows `POST /subjects/bulk` left under `uma`'s name; then `uma` deleted,
and the same export again:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit/count?action=subject.amend"; echo
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit/export?action=subject.amend"
curl -sS -o /dev/null -w '%{http_code}\n' -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-cc42-7dc9-a0bd-7fcd5dc9c35e"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit/export?action=subject.amend"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/audit/count?action=audit.export"; echo
```

```
{"count":2,"capped":false}
HTTP/1.1 200 OK
x-request-id: 01a0ee8c-6e3f-75fe-8e8e-20a87f45ac41
cache-control: no-store
content-type: application/x-ndjson; charset=utf-8
content-length: 1141
Date: Tue, 29 Sep 2026 19:02:55 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0ee8c-69d4-7064-bae0-23af3f0d9bf6","occurred_at":"2026-09-29T19:02:54.671Z","event_type":"admin_mutation","action":"subject.amend","outcome":"refused","actor_tenant_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","actor_subject_id":"01a0ee8a-cc42-7dc9-a0bd-7fcd5dc9c35e","actor_client_id":"01a0ee8a-c3a0-7429-ab4a-4ecef6baf694","actor_name":"uma","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee8a-c8f6-7450-b486-861a66a87684","request_id":"01a0ee8c-69b5-7e9b-a23c-621c22a3eb69","ip":"172.22.0.1","detail":{"denied":["manage-tenant"]}}
{"id":"01a0ee8c-69ce-7674-a090-e64e603e8a49","occurred_at":"2026-09-29T19:02:54.658Z","event_type":"admin_mutation","action":"subject.amend","outcome":"allowed","actor_tenant_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","actor_subject_id":"01a0ee8a-cc42-7dc9-a0bd-7fcd5dc9c35e","actor_client_id":"01a0ee8a-c3a0-7429-ab4a-4ecef6baf694","actor_name":"uma","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee8c-67c6-7752-904b-584bbc614619","request_id":"01a0ee8c-69b5-7e9b-a23c-621c22a3eb69","ip":"172.22.0.1","detail":{"enabled":{"after":false,"before":true}}}
204
{"id":"01a0ee8c-69d4-7064-bae0-23af3f0d9bf6","occurred_at":"2026-09-29T19:02:54.671Z","event_type":"admin_mutation","action":"subject.amend","outcome":"refused","actor_tenant_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","actor_subject_id":"01a0ee8a-cc42-7dc9-a0bd-7fcd5dc9c35e","actor_client_id":"01a0ee8a-c3a0-7429-ab4a-4ecef6baf694","actor_name":null,"actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee8a-c8f6-7450-b486-861a66a87684","request_id":"01a0ee8c-69b5-7e9b-a23c-621c22a3eb69","ip":"172.22.0.1","detail":{"denied":["manage-tenant"]}}
{"id":"01a0ee8c-69ce-7674-a090-e64e603e8a49","occurred_at":"2026-09-29T19:02:54.658Z","event_type":"admin_mutation","action":"subject.amend","outcome":"allowed","actor_tenant_id":"01a0ee8a-c394-7b49-942b-3dea70a962e7","actor_subject_id":"01a0ee8a-cc42-7dc9-a0bd-7fcd5dc9c35e","actor_client_id":"01a0ee8a-c3a0-7429-ab4a-4ecef6baf694","actor_name":null,"actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee8c-67c6-7752-904b-584bbc614619","request_id":"01a0ee8c-69b5-7e9b-a23c-621c22a3eb69","ip":"172.22.0.1","detail":{"enabled":{"after":false,"before":true}}}
{"count":2,"capped":false}
```

The second export names no actor: `actor_name` is resolved when a row is read
(see `GET /audit`), and `uma` is gone.
