---
title: Quick start
description: Start Odudu with Docker Compose, read the first administrator's password from the setup log and sign in to the console.
---

# Quick start

Start Odudu on one machine with Docker Compose, then sign in to its console as the first administrator.

This is for trying Odudu out. The server listens on loopback only and the database password is fixed and public, so do not run it on a shared host.

## Start it

The file is `quickstart/compose.yaml` in the repository. It starts Postgres, a one-time setup step and the server. Setup creates the database roles, applies the migrations and makes the first administrator.

```text
ODUDU_ADMIN_EMAIL=you@example.com docker compose up -d
docker compose logs setup
```

- With no `ODUDU_ADMIN_EMAIL`, a bare `docker compose up -d` makes the administrator `admin@odudu.local`.
- Under `up` setup has no terminal, so it takes `ODUDU_ADMIN_PASSWORD` if you set it and otherwise generates a password. The setup log prints the console address, the email and the generated password once, and the password must be changed at first sign-in.
- `docker compose run --rm setup` from a terminal asks you for the password instead.
- The compose file names the image `ghcr.io/wizzywit/odudu:0.0.0`, a placeholder. The released tag is stamped in when a release is made; set `ODUDU_IMAGE` to the image you have until then.

## What comes next

1. **Sign in to the console** at the address the setup log printed. You meet the same sign-in page a user meets. The guide [An admin signs in and changes a user](../guides/admin-signs-in-and-changes-a-user.md) shows each request behind it.
2. **Sign a user in** through the authorization code flow, as in [Sign a user in](../guides/sign-a-user-in.md).
3. **Change a user and read the audit trail**, which the admin guide ends with.

Read [Refresh and end a session](../guides/refresh-and-end-a-session.md) to keep people signed in, and [Concepts](../concepts/index.md) for what a tenant, a client and a token are.

<!-- filled by Increment 24 -->
