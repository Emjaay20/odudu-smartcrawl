---
title: 'GET /mail'
description: 'Requires manage-tenant, the capability SMTP is configured with.'
---

# `GET /mail`

Requires `manage-tenant`, the capability SMTP is configured with. The tenant's
outgoing mail, most recent first and cursored: `queued`, not yet tried;
`retrying`, failed and to be offered again; `sent`; or `failed`, every attempt
the sender makes spent (`ODUDU_OUTBOX_MAX_ATTEMPTS`) — with its subject line,
attempts, the relay's last error and when it is next due. Never the body: it
carries the link a recipient signs in with. `?status=` narrows it.

The recipient is a subject's address, which reading takes `view-users`
everywhere else, so a caller without `view-users` sees it masked — its first
character and its domain — wherever it appears, with `to_masked` true. A
relay's error quoting it back is masked too, matched without regard to case
and as a whole address, so `<Grace@Navy.Example>` is masked as surely as the
address as stored, and so is its local part followed by `@` on its own. `manage-tenant` alone says that mail went
and whether it failed, not to whom.

After the two links above were queued: one pass of the sender, run by hand,
which the relay at `postgres:25` refuses; the outbox as `$ADMIN_TOKEN` reads it;
then as `mona`, signed in to the tenant's own admin client (`$MONA_TOKEN`):

```bash
docker compose exec -T odudu node dist/main.js send-mail 2>/dev/null
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail"; echo
curl -sS -H "Authorization: Bearer $MONA_TOKEN" "$P/whoami"; echo
curl -sS -H "Authorization: Bearer $MONA_TOKEN" "$P/mail?status=retrying"; echo
```

```
{"level":30,"time":1790708573691,"pid":404,"hostname":"1dd2b3990a77","msg":"ODUDU_SMTP_HOST is unset; capturing outgoing mail instead of sending it"}
{"level":40,"time":1793063685215,"pid":48,"hostname":"cf1967a58204","err":{"type":"Error","message":"connect ECONNREFUSED 172.20.0.2:25","stack":"Error: connect ECONNREFUSED 172.20.0.2:25\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:2083:16)","errno":-111,"code":"ESOCKET","syscall":"connect","address":"172.20.0.2","port":25,"originalCode":"ECONNREFUSED","command":"CONN"},"messageId":"01a0ee8c-62a9-7880-8d8c-61381391ed4a","attempts":1,"msg":"outbox message failed and will be retried"}
{"level":40,"time":1793063685218,"pid":48,"hostname":"cf1967a58204","err":{"type":"Error","message":"connect ECONNREFUSED 172.20.0.2:25","stack":"Error: connect ECONNREFUSED 172.20.0.2:25\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:2083:16)","errno":-111,"code":"ESOCKET","syscall":"connect","address":"172.20.0.2","port":25,"originalCode":"ECONNREFUSED","command":"CONN"},"messageId":"01a0ee8c-62cf-7422-b5a9-7220bfeef117","attempts":1,"msg":"outbox message failed and will be retried"}
{"ran":true,"sent":0,"failed":2}
{"items":[{"id":"01a0ee8c-62cf-7422-b5a9-7220bfeef117","to":"grace@navy.example","to_masked":false,"subject":"Verify your ops-demo account","status":"retrying","attempts":1,"last_error":"connect ECONNREFUSED 172.22.0.2:25","created_at":"2026-09-29T19:02:52.872Z","next_attempt_at":"2026-09-29T19:03:53.692Z","sent_at":null},{"id":"01a0ee8c-62a9-7880-8d8c-61381391ed4a","to":"grace@navy.example","to_masked":false,"subject":"Reset your ops-demo password","status":"retrying","attempts":1,"last_error":"connect ECONNREFUSED 172.22.0.2:25","created_at":"2026-09-29T19:02:52.832Z","next_attempt_at":"2026-09-29T19:03:53.692Z","sent_at":null}]}
{"subjectId":"01a0ee8a-c8f6-7450-b486-861a66a87684","issuerTenantId":"01a0ee8a-c394-7b49-942b-3dea70a962e7","capabilities":["manage-tenant"],"crossTenant":false}
{"items":[{"id":"01a0ee8c-62cf-7422-b5a9-7220bfeef117","to":"g***@navy.example","to_masked":true,"subject":"Verify your ops-demo account","status":"retrying","attempts":1,"last_error":"connect ECONNREFUSED 172.22.0.2:25","created_at":"2026-09-29T19:02:52.872Z","next_attempt_at":"2026-09-29T19:03:53.692Z","sent_at":null},{"id":"01a0ee8c-62a9-7880-8d8c-61381391ed4a","to":"g***@navy.example","to_masked":true,"subject":"Reset your ops-demo password","status":"retrying","attempts":1,"last_error":"connect ECONNREFUSED 172.22.0.2:25","created_at":"2026-09-29T19:02:52.832Z","next_attempt_at":"2026-09-29T19:03:53.692Z","sent_at":null}]}
```
