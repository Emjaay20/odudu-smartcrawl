---
title: Backups
description: What to copy so a lost server can be rebuilt, and what the project has not yet proven.
---

# Backups

You will take a copy of Odudu's database, keep its encryption key beside it but separately, and check that the copy can be read. Everything Odudu knows is in one PostgreSQL database plus a few secrets in the server's environment, so that is all there is to back up.

The mechanism is `pg_dump`. Written backup and restore guidance, proven by an actual restore, is not done: it is planned work ([roadmap](../roadmap.md), P12). Until then this page is what the project knows, not a promise that a restore works for your deployment. Restore into a scratch database once, so you find out before you need it.

## What to keep

Keep two things, and keep them apart.

- **The database.** Every tenant's people, clients, keys, settings and audit trail are rows in the one database `ODUDU_DATABASE_URL` points at.
- **The secrets.** `ODUDU_KEK` wraps every signing key and every console token stored in that database, and `ODUDU_CONSOLE_CLIENT_KEY` is registered on every tenant. A dump restored without the same `ODUDU_KEK` holds keys nobody can unwrap, so the signing keys and the stored console sessions cannot be read. Keep both values in your secret store, in a different place from the dumps. A dump with its key beside it hands both to anyone who finds it.

The two database roles are not in a dump, because roles belong to the PostgreSQL cluster. Recreate them first ([Deploying](./deploying.md), step 2) before you restore into a new cluster.

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

You should see a line of `TABLE DATA` for each table. Then restore it into a scratch database on a Postgres of the same major version, and sign in to a server started against it with the same `ODUDU_KEK`. That is the proof that matters, and it is yours to run for now.

## 3. Keep the copy

Copy the dump off the machine that made it, on a schedule that matches how much you can afford to lose, and keep several.

## What a backup does not cover

- Mail still waiting in the outbox goes back to the state it had when the dump was taken, so a restore may send a message that was already sent, or miss one queued after.
- The audit trail is a table like the rest, so a restore returns it to the moment of the dump. An export of it that you made earlier is yours to keep.
