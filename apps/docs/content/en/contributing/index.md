---
title: Contributing
description: Build Odudu from source, run its tests and send a change.
---

# Contributing

You want to build Odudu from source, run its tests and send a change. This page gets you to a green checkout. The pages after it explain how the code is laid out, how the tests are organised and how a piece of work is planned and finished.

## Before you start

- Node 24 or later, and pnpm 12.3.4. Both are pinned in the root `package.json`.
- Docker. The integration tests start a real PostgreSQL in a container, so they need a running Docker daemon.

## 1. Get the source and install

Clone the repository, then install from its root.

```text
git clone https://github.com/wizzywit/odudu.git && cd odudu && pnpm install
```

Turn on the commit-message check once per clone. It runs the same rules as the check on every pull request.

```text
git config core.hooksPath .githooks
```

## 2. Run the checks

Run these from the repository root. Each one fails the pull request in CI if it fails here.

- `pnpm format:check` for formatting.
- `pnpm typecheck` and `pnpm lint`.
- `pnpm boundaries` for the import rules between packages.
- `pnpm test` for every package's unit and integration tests, then `pnpm trace`.
- `pnpm verify` runs the whole sequence in order.

[Running the tests](./running-the-tests.md) says what each kind of test does and how to run just one.

## 3. Find your way around

[Architecture](./architecture.md) has the layers every package follows and a map of what each directory holds. Read it before you add code, because the import rules are checked and a misplaced file fails the build.

## 4. Send a change

Work on a branch, and open a pull request. `main` is protected, and its checks must pass before a merge. Write each commit message as what changed and why, in a subject of at most 72 characters and a body of at most 8 lines. Reasoning that needs more room goes in a decision record under `docs/adr/`.

[The phase process](./the-phase-process.md) describes how larger pieces of work are planned, built and reviewed, which is how most of the project has been written.

## Also here

[How the transcripts are captured and checked](./transcripts.md) covers the recorded runs.
