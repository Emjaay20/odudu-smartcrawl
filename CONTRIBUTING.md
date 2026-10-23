# Contributing to Odudu

Thank you for helping. This page is the short version. The
[Contributing section of the documentation](https://wizzywit.github.io/odudu/docs/contributing/) has the depth:
how the code is laid out, how the tests are organised and how larger work is
planned.

Please read the [code of conduct](CODE_OF_CONDUCT.md) first. To report a
security problem, follow [SECURITY.md](SECURITY.md) and not an issue.

## Before you send a change

Open an issue first for anything bigger than a fix, so we can agree on the
shape of it. Outside contributions are accepted under a contributor licence
agreement, as [ADR 0042](docs/adr/0042-distribution-licensing-and-the-paid-boundary.md)
decides. The agreement text is not published yet, so until it is, ask in the
issue before you write code.

[LICENSING.md](LICENSING.md) says which licence covers which directory: the
server and tools are AGPL-3.0-only, and the examples and the guides are
Apache-2.0.

## Set up

You need Node 24, pnpm and Docker. The integration tests start a real PostgreSQL
in a container, so Docker has to be running.

```sh
git clone https://github.com/wizzywit/odudu.git && cd odudu && pnpm install
git config core.hooksPath .githooks
```

The second line turns on the commit-message check. To start Odudu from the
checkout, copy the two environment files and run the Compose stack in
`infra/docker`: [Run it from a checkout](https://wizzywit.github.io/odudu/docs/contributing/run-from-a-checkout/) has each step.

## Run the checks

```sh
pnpm verify
```

`pnpm verify` runs formatting, types, lint, the import boundaries, the build
and every test in order. It needs Docker. Run the steps one at a time while you
work:

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` and `pnpm boundaries`
- `pnpm test` for every package's unit and integration tests, then `pnpm trace`

`pnpm verify` does not build the container image or run the docs browser tests.
CI does both, on every pull request.

## Write the test first

A change that alters behaviour starts with a test that fails. Integration tests
run against a real PostgreSQL, never a mock. No `any`, and no lint waiver in a
comment.

## Commit messages

A subject of at most 72 characters, a blank line, and a body of at most 8
lines. Say what changed and why. Longer reasoning goes in an ADR under
`docs/adr/`. No tool attribution of any kind, in a commit or in a pull request
description.

## How work is planned

Larger pieces of work run in phases. Each phase gets a spec and a plan before
any code, is built in increments that each end with green CI, and closes with a
review of the whole branch. `main` is protected, and its checks must pass before
a merge.

Documentation is part of the change. Update the page that describes what you
changed in the same commit, and the tests under `tests/docs` will tell you when
it drifted. [The phase process](https://wizzywit.github.io/odudu/docs/contributing/the-phase-process/) explains the rest.

## A good bug report

Open the bug form and fill in:

- the version, from `odudu --version`
- the image digest, if you run the container (`docker image inspect` shows it)
- what you did, what you expected and what happened
- the tail of the server log from the stack, `docker compose logs odudu`, with
  secrets redacted: passwords, tokens, keys and the database URL

For a vulnerability, do not open an issue. Use [SECURITY.md](SECURITY.md).
