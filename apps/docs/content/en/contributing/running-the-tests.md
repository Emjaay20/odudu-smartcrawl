---
title: Running the tests
description: What each kind of test in the repository does, how to run all of them or one, and what fails when documentation drifts.
---

# Running the tests

You will run the whole suite once, then learn to run only the part you changed. The suite is large on purpose: Odudu's claims about what it does are held by tests, not by review.

## 1. Run everything

`pnpm verify` runs, in order, formatting, type checks, lint, the Node-native ESM check, the import boundaries, the build, every package's tests and the trace check. It stops at the first failure. To run a step alone, run its script: `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test:node-esm`, `pnpm boundaries`, `pnpm test` or `pnpm trace`.

`pnpm trace` reads the report each package's tests wrote, so run `pnpm test` first. It fails when a MUST in a protocol reading note under `docs/protocols/` has no test.

## 2. Know the kinds of test

- **Unit tests** need nothing running and finish in seconds. `pnpm test:unit` runs them all.
- **Integration tests** start a real PostgreSQL 17 in a container through Testcontainers, never a mock, so they need Docker. `pnpm test:integration` runs them all. A test named `*.int.test.ts` is one of these.
- **Boundary tests** under `tests/boundaries` check the import rules between packages and layers.
- **Lint tests** under `tests/lint` hold rules ESLint cannot, such as the longest permitted comment, that no source file waives a lint rule, and that no page's text is typed into its renderer.
- **Documentation tests** under `tests/docs` and `apps/docs/tests` compare what the documentation says with what the server serves, and fail the build when they differ. A claim that can be checked is checked, and when you add one to a page you add the check with it.
- **Console end-to-end tests** drive the admin console in a real browser against a running stack.

## 3. Run one thing

To run one package's tests from its directory, run `pnpm test` there. To run one file or one kind from the root, use Vitest directly:

```text
node_modules/.bin/vitest run --project unit tests/docs tests/lint
```

The projects are `unit`, `integration`, `plans`, `browser` and `dom`. `plans` checks the query plan of each list endpoint against an index, and runs with `pnpm test:plans`.

## 4. The documentation site

The site has its own checks. Its unit tests run with `pnpm --filter @odudu/docs test`, and its browser tests, which open the built site in Chromium, with `pnpm --filter @odudu/docs test:browser`. Both read the built pages and the generated reference, so build first with `pnpm --filter @odudu/docs build:pages`.

The commands in the quick start and the guides run for real in CI against a live stack. To run them yourself, bring up the quick start's stack and give `node tools/docs-run/src/index.ts` the directories of pages to run.

## 5. Write the test first

New behaviour starts with a test that fails for the right reason. Every repository method is probed with another tenant's id, because tenant isolation is the property the whole design rests on.
