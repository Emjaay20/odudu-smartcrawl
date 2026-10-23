---
title: 'GET /clients/:id/logout-deliveries'
description: 'Requires manage-clients. The Back-Channel Logout Tokens queued for the client, most recent first and cursored: pending, delivered, or failed once…'
---

# `GET /clients/:id/logout-deliveries`

Requires `manage-clients`. The Back-Channel Logout Tokens queued for the
client, most recent first and cursored: `pending`, `delivered`, or `failed`
once every attempt `send-logouts` makes is spent
(`BACKCHANNEL_LOGOUT_MAX_ATTEMPTS`), with the attempts, the last error and the
endpoint. Never the token itself. `?status=` narrows it; an unknown client
answers `404`.

After `DELETE /sessions` above queued a token for each of `ops-app`'s two
sessions it ended, and one pass of the sender, run by hand:

```bash
docker compose exec -T odudu node dist/main.js send-logouts 2>/dev/null
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/clients/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123/logout-deliveries"; echo
```

```
{"ran":true,"delivered":0,"failed":2}
{"items":[{"id":"01a0ee8c-5536-7104-abd0-6c8afe2c2850","session_id":"01a0ee8b-28f4-79df-bbe5-95698666977b","endpoint":"https://postgres:9/backchannel","status":"pending","attempts":1,"last_error":"connect ECONNREFUSED 172.22.0.2:9","created_at":"2026-09-29T19:02:49.371Z","next_attempt_at":"2026-09-29T19:03:50.227Z","delivered_at":null},{"id":"01a0ee8c-552f-7614-bf53-93c13eeca916","session_id":"01a0ee8b-27fa-7271-bb21-8bf1dec2d0fa","endpoint":"https://postgres:9/backchannel","status":"pending","attempts":1,"last_error":"connect ECONNREFUSED 172.22.0.2:9","created_at":"2026-09-29T19:02:49.371Z","next_attempt_at":"2026-09-29T19:03:50.227Z","delivered_at":null}]}
```

Each pass spends one attempt on each token it offers, so a token one failed
pass has offered answers `attempts: 1`, and a token is offered
`BACKCHANNEL_LOGOUT_MAX_ATTEMPTS` times before it is `failed`.
