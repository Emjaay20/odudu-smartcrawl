---
title: 'Password reset and verification mail for a subject'
description: "Requires manage-users. Each queues a link to the subject's own address, minted and mailed by the same write the self-service door makes…"
---

# Password reset and verification mail for a subject

This page covers `POST /subjects/:id/password-reset` and `POST /subjects/:id/verification`.

Requires `manage-users`. Each queues a link to the subject's own address, minted
and mailed by the same write the self-service door makes (`enqueueResetLink` and
`enqueueVerificationLink`, `@odudu/account`), and answers `202` with no body:
the link is never in the response, nor in the audit row,
`subject.password_reset_send` or `subject.verification_send`, whose `detail` is
empty. Each is held to the target ceiling like every other write under
`/subjects/:id`, and each is throttled per origin with the sign-in, registration
and reset-request submissions (ADR 0023; not shown here, since the budget was
raised for these runs — an integration test holds it). A subject with no `users`
row answers `404`. Each refusal a link would otherwise meet later, silently, is
a `409` of its own type:

- `about:blank#no-email` — the subject has no address;
- `about:blank#reset-password-off`, a reset only — the tenant's
  `reset_password_allowed` is off, so its reset page would refuse the link;
- `about:blank#no-mail-relay` — `GET /smtp` would answer `effective` `none`:
  the tenant has no relay and the deployment no sender, so the mail would
  only be logged.

None of the three writes a row: each is a conflict with the data, not a guard
(ADR 0037's amendment of 2026-09-28). For `grace` and then `linus`, who has no
address, taking each refusal in turn: the setting, then a relay for `ops-demo`
at the stack's own `postgres` container, port 25, where nothing listens:

```bash
G=01a109f6-6f97-7579-a5ed-5c486dcd23aa
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/password-reset"; echo
curl -sS -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"reset_password_allowed":true}' "$P/settings" | grep -o '"reset_password_allowed":[a-z]*'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/smtp"; echo
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/password-reset"; echo
curl -sS -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"host":"postgres","port":25,"from_address":"noreply@ops.example"}' "$P/smtp"; echo
curl -sS -D - -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/password-reset"
curl -sS -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/verification"
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c748-743d-b60e-9b0ed48221a3/verification"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit?resource_type=subject&resource_id=$G&action=subject.password_reset_send"; echo
```

```
{"type":"about:blank#reset-password-off","title":"Conflict","status":409,"detail":"reset_password_allowed is off, so the tenant would refuse the link; turn it on with PATCH /settings first","instance":"01a0ee8c-61e6-766b-9b7d-dfa1705a654d"}
"reset_password_allowed":true
{"configured":false,"host":null,"port":null,"from_address":null,"username":null,"password_set":false,"starttls":null,"effective":"none"}
{"type":"about:blank#no-mail-relay","title":"Conflict","status":409,"detail":"the tenant has no relay and the deployment no sender, so the mail would only be logged","instance":"01a0ee8c-6254-71bb-99ff-38173b7334d0"}
{"configured":true,"host":"postgres","port":25,"from_address":"noreply@ops.example","username":null,"password_set":false,"starttls":false,"effective":"tenant"}
HTTP/1.1 202 Accepted
x-request-id: 01a0ee8c-6291-7ba8-91e6-d08ea702a515
cache-control: no-store
content-length: 0
Date: Tue, 29 Sep 2026 19:02:52 GMT
Connection: keep-alive
Keep-Alive: timeout=72

202
{"type":"about:blank#no-email","title":"Conflict","status":409,"detail":"the subject has no email address to send to","instance":"01a0ee8c-62de-71e8-afbb-2a704e8fa724"}
{"items":[{"id":"01a0ee8c-62ab-7858-b95a-960db8f34277","occurred_at":"2026-09-29T19:02:52.832Z","event_type":"admin_mutation","action":"subject.password_reset_send","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","request_id":"01a0ee8c-6291-7ba8-91e6-d08ea702a515","ip":"172.22.0.1","detail":{}}]}
```
