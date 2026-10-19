# 0044 — CI runs what a change can affect, in parallel, and one check says whether it passed

**Status:** Accepted · 2026-10-19

## Context

One job, `verify`, ran every static check and every package's tests in series,
and the heavy jobs (`e2e`, `conformance`, `query-plans`, `container`) ran on
every pull request, a one-word change to a document included.

Run 39244251543 showed what that costs. `verify` was cancelled at its 45-minute
limit and `docs` at ten minutes. The log of the cold `verify` shows where the
time went: `protocol-admin` 21 minutes, `admin-console` 18, `protocol-oidc` 16,
`server` 8, in one job. A cancelled or failed run saves no Turborepo cache
(`actions/cache` saves only on success), so every red run was followed by a
cold one.

The `docs` job's cause was not slowness. `pnpm test` in `apps/docs` ran vitest
without `--project`, so the `browser` project ran before Chromium was
installed. `chromium.launch()` threw in `beforeAll`; `afterAll` then called
`browser.close()` on `undefined` before it reached `server.kill()`, and the
orphaned `serve.mjs` held the worker's stdio open. Vitest never exited. The
same hang sat at the end of `verify`, which also runs the docs tests through
Turborepo.

## Decision

- **Cut the work by what changed.** A `changes` job classifies the files a pull
  request touches (`tools/ci/src/changes.ts`, unit-tested). The diff lists both
  sides of a rename and is NUL-separated, so a source file moved into `docs/`
  still counts, and only Markdown under `docs/` is prose. A change confined
  to prose and the docs app skips `e2e`, `conformance`, `query-plans` and the
  heavy test slices. Anything not recognised as prose, including every
  workflow, tool, lockfile and root config, runs everything, as does a push to
  main and any diff the script cannot compute. `docs/protocols/` counts as
  code: the trace check reads it against every package's report.
- **Split `verify`.** `static` runs the checks that need no database; the tests
  are a matrix. The four packages that dominate are sliced with vitest's
  `--shard`, set through `ODUDU_TEST_SHARD` and listed in the `env` of every
  test task in `turbo.json`, so a slice's cache entry is its own and typecheck
  entries stay shared. `tests/lint/ci-workflow.test.ts` fails if a test task
  omits it. A command-line `--` argument would have hashed into the typecheck
  tasks too. The other packages share one job. `docs` is its own job.
- **The trace check runs after the slices.** Each leg uploads its
  `trace-report.json`; `trace` joins the slices of a package
  (`tools/ci merge-reports`) and runs `pnpm trace` unchanged. Each report is
  uploaded beside a `trace-shard` file holding the `i/n` its leg ran; the merge
  fails on a missing, repeated or differently counted slice, and the uploads
  fail on a missing file, so a lost slice cannot pass as a smaller package.
- **Save the Turborepo cache on a red run.** `actions/cache/restore`, then
  `actions/cache/save` with `always() && !cancelled()`. The prune step runs
  only on success: a failed run's summary omits the tasks it never reached, and
  pruning to it would discard exactly the entries the next run needs. Each leg
  has its own key prefix.
- **One check to require: `gate`.** It needs every other job and fails on a
  failed or cancelled one, or if `changes` wrote no outputs (every skip would
  then be nobody's decision); a skipped job passes. GitHub's documentation
  says a job skipped by a job-level `if` reports success, so a required check
  that is skipped does not block a merge; only a workflow-level `paths` filter
  leaves a required check pending forever, and this workflow has none. That is
  documentation read, not behaviour observed here: the first validation run
  (a prose-only pull request, docs/phases/p4g.md) confirms it before any
  required check is removed. `gate` makes the rule independent of the answer:
  one check that is always reported. `verify` stays as the aggregate of
  `static`, `test`, `test-rest` and `trace`, so a branch protection rule that
  names it keeps working.
- **Slow steps carry their own limit** (the docs tests 8 minutes, the browser
  test 4), so a hang fails in the step that hung, and the cache-saving step
  after it still runs. Chromium is cached by Playwright version.

`turbo --affected` is not used. It selects by changed package files; measured
here, a commit touching only `docs/phases/p4g.md` selected no test task at all,
although `tests/docs` reads that directory. The Turborepo cache already skips
an unchanged package by content hash, including inputs outside it, and
replays its report, which the trace check needs. A task skipped by
`--affected` writes none.

## Consequences

- Slice counts (`protocol-oidc` 3, `protocol-admin` 4, `admin-console` 2,
  `server` 2, plus a rest job) follow the cold run's per-package times
  (1273, 1054, 960 and 505 s, four packages sharing one runner), aiming at
  about five minutes a leg. vitest cuts slices by file hash, not duration, and
  integration files are the slow ones, so legs will not be equal; adjust from
  the per-job times of the first runs.
- Cache volume: a run writes about 14 caches (`static`, 11 test legs,
  `test-rest`, `docs`), most of them kilobytes (test tasks output one report;
  the builds and the docs site are the large ones), expected under 250 MB a
  run. GitHub's limit is 10 GB per repository with least-recently-used
  eviction, so a busy week could evict main's entries, which are the ones a new
  branch restores. The prune step stays: it holds a cache to what its run
  names. Check the cache list after about five runs. A red run saves unpruned,
  bounded by one run's growth.
- A new job must be added to `gate`'s `needs`; the lint test enforces it, with
  the other structural rules of the workflow.
- A prose-only pull request still runs `static`, `docs`, the repository checks
  and `commit-messages`.
- `concurrency` cancels an earlier run of `main` when two merges land close
  together, so that commit's `gate` reads cancelled. It was so before; read
  main's state from the newest run.
- Docker layer caching of the image build (`container`, `e2e`) is not done.

## Alternatives rejected

**Nx.** Considered for its affected graph, Nx Cloud's distributed task
execution and its test atomizer, which splits a test task per file. Rejected for
now. Migrating a working Turborepo setup (task definitions, cache inputs,
per-package scripts) costs more than the saving, and Turborepo already has
content-hash caching and `--affected`. The distributed execution and the
atomizer are the paid part. A required-check problem (a conditional job that
is skipped) exists under Nx as under anything else, and `gate` solves it
either way. **Revisit** when several apps have separate release cycles, so
that an affected graph picks which to release, or when CI minutes become a
real cost that matrix sharding on hosted runners no longer holds down.

**`dorny/paths-filter`.** A third-party action for what is forty lines of
tested script, and one more thing to pin and trust.

**One job per package.** Fine-grained, but the cold-install cost repeats
twenty-five times; slicing only the four large packages gets most of it.
