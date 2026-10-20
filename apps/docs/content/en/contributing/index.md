---
title: Contributing
description: Build Odudu from source, run its tests and send a change.
---

# Contributing

Build Odudu from source, run its tests and send a change.

## What you need

- Node 24 or later, and pnpm 12.3.4. Both are pinned in the root `package.json`.
- Docker. The integration tests start a real PostgreSQL in a container, so they need a running Docker daemon.

## Checks

Install with `pnpm install`, then run the checks from the repository root:

- `pnpm format:check` for formatting.
- `pnpm typecheck` and `pnpm lint`.
- `pnpm boundaries` for the import rules between packages.
- `pnpm test` for every package's unit and integration tests, then `pnpm trace`.
- `pnpm verify` runs the whole sequence in order.

[How the transcripts are captured and checked](./transcripts.md) covers the recorded runs.

<!-- filled by Increment 27 -->
