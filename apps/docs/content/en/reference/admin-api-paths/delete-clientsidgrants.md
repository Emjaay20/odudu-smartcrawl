---
title: 'DELETE /clients/:id/grants'
description: 'Requires manage-sessions, the capability every other grant revocation takes.'
---

## `DELETE /clients/:id/grants`

Requires `manage-sessions`, the capability every other grant revocation takes.
Revokes every grant issued through the client that nothing has revoked,
whoever holds it, so no refresh token the client holds is honoured again —
for a leaked secret or a compromised relying party, without disabling the
client, which a re-enable would undo. It ends no session, so a session still
signed in can be issued a fresh grant; `DELETE /sessions` is that door. A
grant whose subject holds an admin capability the caller does not is left
alone and counted under `beyond_ceiling`, and the route is held to the
ceiling on the client's service account, as every client mutation is.
`client.grants_revoke` carries both counts. An unknown client answers `404`.

Against the tenth stack, after `linus` signed in again asking for
`offline_access`, and `sam` again (`$SAM_TOKEN`): `sam` first, then
`$ADMIN_TOKEN`, then `mona`'s grants:

```bash
curl -sS -X DELETE -H "Authorization: Bearer $SAM_TOKEN" \
  "$P/clients/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123/grants"; echo
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/clients/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123/grants"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c8f6-7450-b486-861a66a87684/grants"; echo
```

```
{"revoked":1,"beyond_ceiling":1}
{"revoked":1,"beyond_ceiling":0}
{"items":[]}
```

### How many one call revokes

Likewise at most 10,000 grants per call, with `remaining` counting what is
left. The transcript above is the tenth stack's, run on 2026-09-29
before the cap existed, so its answer lacks `remaining`; the one below is
the current shape. Against `perf-demo`, with one grant
for `grace` through `alpha-app` written by `insert into token_grants`:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/grants"; echo
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$P/clients/$ALPHA/grants"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/grants"; echo
```

```
{"items":[{"id":"6f876d15-21b1-48f4-9062-8f83949fe351","client_id":"01a10f7d-edbc-792a-b693-f9abee8b7a7e","client_key":"alpha-app","scope":"openid","created_at":"2026-10-06T04:38:13.106Z","session_id":null,"offline":false,"refresh_expires_at":null}]}
{"revoked":1,"beyond_ceiling":0,"remaining":0}
{"items":[]}
```
