---
title: Scaling
description: Why Odudu runs as one instance today, what that costs and where more are planned.
---

# Scaling

You will decide how big to make the one server Odudu runs as, and what to do when it is not enough. Run one instance. More than one is not supported yet, and the reasons are specific, so you can judge them for yourself.

## Why one instance

- **Migrations run at start, in every process, with no lock.** Two servers starting at once would race to change the same database.
- **The throttles count in one process's memory.** The per-origin, sign-in and client-secret limits are windows held by the process that served the request, so each of two instances would allow the full budget and a caller could spend both.

Replicas, a migration lock and limits shared between instances are planned in [the roadmap](../roadmap.md#later) under many instances and performance, with a metrics endpoint and a deadline on the two outbound lookups that `/token` and `/userinfo` make. Nothing in the product today depends on them being there.

## What to do meanwhile

1. **Make the one instance bigger, not more.** Give it more CPU first. Password hashing is the expensive step of a sign-in, and it runs in the server.
2. **Watch the database.** Every request reads and writes Postgres, and every tenant shares it. Size it as you would any busy transactional database, and keep it close to the server.
3. **Keep the schedules on.** Retention keeps the tables that grow with every sign-in from growing without bound ([Deploying](./deploying.md), step 7).
4. **Restart fast.** One container means a restart is an outage. A restart takes as long as the migrations and the boot, so keep the image pulled and the health check watched.

## How big it is meant to get

Odudu is designed for one tenant of a million people and ten thousand clients, ten thousand tenants, and a hundred million audit events. Every list endpoint is bounded and served by an index. The load and latency numbers that prove it for a deployment, and read replicas, are planned work on [the roadmap](../roadmap.md#later), so measure your own before you rely on the design figure.
