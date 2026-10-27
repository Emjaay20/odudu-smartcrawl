---
title: "A subject's grants: list and revoke"
description: "Requires manage-sessions: a grant is what a token is presented under, so it is a session's concern, and ending one is the same capability's."
---

# A subject's grants: list and revoke

This page covers `GET /subjects/:id/grants` and `DELETE /subjects/:id/grants/:clientId`.

Requires `manage-sessions`: a grant is what a token is presented under, so it
is a session's concern, and ending one is the same capability's. `GET` lists
every grant the subject holds that nothing has revoked, cursored by id, each
with the client it was issued through, its scope, the session bounding it and
`offline` — true for an `offline_access` grant, which no session bounds and
ending sessions leaves alone — and `refresh_expires_at`, when its newest
unspent refresh token lapses. Never a token. `DELETE` revokes every grant the
subject holds through the client (`:clientId` is the client's row id), offline
ones included, with the write revoking a consent makes
(`revokeForSubjectClient`), but without withdrawing the consent, and answers
how many; it ends no session. It is held to the target ceiling, and writes
`grant.revoke`. An unknown subject answers `404`.

`grace`'s two grants through `ops-app`, the offline one's refresh token
(`$GRACE_OFFLINE_REFRESH_TOKEN`) presented after the revocation, and what is
left:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/grants"; echo
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/grants/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123"; echo
curl -sS -u "ops-app:$OPS_APP_SECRET" --data-urlencode grant_type=refresh_token \
  --data-urlencode "refresh_token=$GRACE_OFFLINE_REFRESH_TOKEN" \
  http://localhost:3082/tenants/ops-demo/protocol/openid-connect/token; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/grants"; echo
```

```
{"items":[{"id":"01a0ee8b-2736-7d56-a78d-5d0c22330e0b","client_id":"01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123","client_key":"ops-app","scope":"openid profile email offline_access","created_at":"2026-09-29T19:01:32.013Z","session_id":null,"offline":true,"refresh_expires_at":"2026-10-13T19:01:32.073Z"},{"id":"01a0ee8b-2871-7378-912a-5d2f335a483d","client_id":"01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123","client_key":"ops-app","scope":"openid profile email","created_at":"2026-09-29T19:01:32.338Z","session_id":"01a0ee8b-27fa-7271-bb21-8bf1dec2d0fa","offline":false,"refresh_expires_at":"2026-10-13T19:01:32.391Z"}]}
{"revoked":2}
{"error":"invalid_grant","error_description":"The code or token is not valid."}
{"items":[]}
```
