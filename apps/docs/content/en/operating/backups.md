---
title: Backups
description: What to copy so a lost server can be rebuilt, and what the project has not yet proven.
---

# Backups

You will take a copy of Odudu's database, keep its encryption key beside it but separately, and check that the copy can be read. Everything Odudu knows is in one PostgreSQL database plus a few secrets in the server's environment, so that is all there is to back up.

The mechanism is `pg_dump`. Written backup and restore guidance, proven by an actual restore, is not done: it is planned work, under [operational readiness](../roadmap.md#later) on the roadmap. Until then this page is what the project knows, not a promise that a restore works for your deployment. Restore into a scratch database once, so you find out before you need it.

## What to keep

Keep two things, and keep them apart.

- **The database.** Every tenant's people, clients, keys, settings and audit trail are rows in the one database `ODUDU_DATABASE_URL` points at.
- **The secrets.** `ODUDU_KEK` wraps every signing key and every console token stored in that database, and `ODUDU_CONSOLE_CLIENT_KEY` is registered on every tenant. A dump restored without the same `ODUDU_KEK` holds keys nobody can unwrap, so the signing keys and the stored console sessions cannot be read. Keep both values in your secret store, in a different place from the dumps. A dump with its key beside it hands both to anyone who finds it.

The database roles are not in a dump, because roles belong to the PostgreSQL cluster. A restore into a new cluster needs them first. The owner role must have the name it had when the dump was taken, because the dump records default privileges by role name, and the restore stops with `role does not exist` without it. Step 3 gives the commands.

## 1. Dump the database

Use the owner connection. The custom format is compressed and lets you restore parts of it.

```text
pg_dump --format=custom --file=odudu-$(date +%F).dump "$ODUDU_DATABASE_URL"
```

On the quick start's stack, where Postgres is a container, the same dump runs inside it:

```sh {run}
docker compose exec postgres pg_dump -U odudu --format=custom --file=/tmp/odudu.dump odudu
```

## 2. Check the copy reads

A dump that exists is not a dump that restores. List its contents, which reads the whole archive's table of contents.

```sh {run expect="TABLE DATA"}
docker compose exec postgres pg_restore --list /tmp/odudu.dump
```

You should see a line of `TABLE DATA` for each table.

## 3. Restore it into a new cluster

Do this once on a scratch PostgreSQL 17, so you know it works before you need it. The steps below were run end to end against a dump of the quick start's stack. The restored database served the `system` tenant's discovery document and signing keys to a server started with the same `ODUDU_KEK`. A restore has not yet been proven with a full sign-in, which [the roadmap](../roadmap.md#later) promises under operational readiness.

1. As an administrator, create the owner under the name it had when you dumped (`odudu` on the quick start's stack, `odudu_owner` if you followed [Deploying](./deploying.md)), the serving role and an empty database. Also create `odudu_app` and give it to the serving role. The migrations normally do this. A restore brings the record that they already ran, so they never run again, and without the grant the serving role has no privileges while `/health/ready` still answers `200`.

```text
CREATE ROLE odudu_owner LOGIN CREATEROLE BYPASSRLS PASSWORD '<owner password>';
CREATE ROLE odudu_svc LOGIN PASSWORD '<serving password>';
CREATE DATABASE odudu OWNER odudu_owner;
CREATE ROLE odudu_app NOLOGIN;
GRANT odudu_app TO odudu_svc;
```

2. Restore the dump with the owner role, stopping at the first error.

```text
pg_restore --no-owner --exit-on-error --dbname "postgres://odudu_owner:<owner password>@<host>:5432/odudu" odudu-2026-01-01.dump
```

3. Start a server against the restored database with the `ODUDU_KEK` and `ODUDU_CONSOLE_CLIENT_KEY` you kept, and check a tenant's keys are served.

```text
curl -fsS https://id.example.com/tenants/system/protocol/openid-connect/certs
```

## 4. Keep the copy

Copy the dump off the machine that made it, on a schedule that matches how much you can afford to lose, and keep several.

## What a backup does not cover

- Mail still waiting in the outbox goes back to the state it had when the dump was taken, so a restore may send a message that was already sent, or miss one queued after.
- The audit trail is a table like the rest, so a restore returns it to the moment of the dump. An export of it that you made earlier is yours to keep.
