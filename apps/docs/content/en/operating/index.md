---
title: Operating Odudu
description: Deploy, configure, upgrade, back up and scale a running installation.
---

# Operating Odudu

Deploy, configure, upgrade, back up and scale a running installation.

## Requirements

These are what the container image needs when you run it against your own Postgres. They come from the README's Deploying section and from the compose files.

- **PostgreSQL 17**, which you operate. The compose files and the integration tests all run version 17.
- **Two database roles.** The owner role in `ODUDU_DATABASE_URL` runs the migrations. It must be able to `CREATE ROLE`, because the migrations create the `odudu_app` role and make the serving role a member of it. It must also be `SUPERUSER` or `BYPASSRLS`: every tenant table forces row-level security, and under a plain owner every request answers "unknown tenant". The serving role, a restricted login role, goes in `ODUDU_APP_DATABASE_URL`.
- **Variables.** `ODUDU_DATABASE_URL`, `ODUDU_APP_DATABASE_URL` and `ODUDU_KEK`, the key the console wraps its stored tokens under. With `NODE_ENV=production` the server refuses to start without `ODUDU_APP_DATABASE_URL`. The console also needs `ODUDU_CONSOLE_CLIENT_KEY`, a private key.
- **TLS in front.** The server speaks plain HTTP. With `NODE_ENV=production` it refuses to start until `ODUDU_TLS=true` says a proxy in front of it terminates TLS. Set `ODUDU_TRUST_PROXY=true` only behind a proxy that overwrites `X-Forwarded-*`.

The quick start's compose file is for trying Odudu out and is not a deployment.

<!-- filled by Increment 27 -->
