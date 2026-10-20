---
title: 'Console paths'
description: "The console gateway: the routes under /console that sign an administrator in to a tenant, hold that administrator's tokens server-side, and forward…"
---

# Console paths

The console gateway: the routes under `/console` that sign an administrator
in to a tenant, hold that administrator's tokens server-side, and forward the
console's calls to the admin API. The browser holds nothing but a session
cookie.

[README.md](https://github.com/wizzywit/odudu/blob/main/README.md) is the **entry point** — what each route does and
which settings turn the console on. [docs/admin-paths.md](../../reference/admin-api-paths/index.md)
is the admin API the proxy forwards to, and this document shows only enough
of it to show the forwarding. There is one "What is not implemented" list
for the whole server, in
[docs/request-paths.md](https://github.com/wizzywit/odudu/blob/main/docs/request-paths.md#what-is-not-implemented); this
document never starts a second one.

Every transcript below is captured output, under the same discipline as
[docs/request-paths.md](../../reference/protocol/index.md): a fenced block holding a response
carries no language tag, a section whose output depends on the state of the
stack says which state, and a precondition a refusal depends on is shown
rather than asserted. `tests/docs/console-paths.test.ts` holds every
`/console/` route this document names to the routes the server serves. Every
audit row below answers `actor_name` and `actor_origin` as well, resolved when
it is read ([Admin paths](../../reference/admin-api-paths/get-audit.md#get-audit)).

**The stack.** The `docker-odudu-1` container of `infra/docker/compose.yaml`,
restarted on the existing database volume. For the first two runs its `odudu`
service was built at commit `5fd4b11`; for the third it was rebuilt at
`6401476`. `ODUDU_PUBLIC_BASE_URL` is `http://localhost:3000` and
`ODUDU_CONSOLE` is left at its default, `true`. The base is plain HTTP, so the
cookies are `odudu-console` and `odudu-console-login`; over `https` they are
`__Host-odudu-console` and `__Host-odudu-console-login` and carry `Secure`.
The image built at those commits shipped no console build, so
`ODUDU_CONSOLE_DIR` (`/app/console`) was absent, and the third run logged
that below. The image has carried a build since `78826ac`;
[`GET /console/`](./get-console.md#get-console) is captured separately, against its own
throwaway stack, because this stack's image carried no console build. The server logged these warnings when it booted for the third
run. The second line is the console cookie's plain-HTTP fallback, and the
third is the missing build:

```
{"level":40,"time":1790590008355,"pid":1,"hostname":"062313e900ce","msg":"authn-flows: serving session cookies without the __Host- prefix because TLS is off. This is expected for local development only — never in production."}
{"level":40,"time":1790590008355,"pid":1,"hostname":"062313e900ce","msg":"console: serving the odudu-console cookie without the __Host- prefix or Secure, because ODUDU_PUBLIC_BASE_URL (http://localhost:3000) is http. This is expected for local development only."}
{"level":40,"time":1790590008445,"pid":1,"hostname":"062313e900ce","msg":"ODUDU_CONSOLE_DIR (/app/console) has no console build (ENOENT); /console/* answers 503"}
```

**The tenant.** Every cookie, code and token below belongs to a throwaway
tenant, `console-paths`, seeded for this capture and holding nothing else.
It was created with the seed CLI, which printed one JSON line per command.
Node's `ExperimentalWarning` lines on stderr are left out.

```bash
docker compose exec -T odudu node dist/main.js seed tenant --name console-paths
docker compose exec -T odudu node dist/main.js seed user --tenant console-paths \
  --username grace --password console-paths-throwaway --email grace@example.com
docker compose exec -T odudu node dist/main.js seed grant-role --tenant console-paths \
  --username grace --role odudu-admin:tenant-admin
docker compose exec -T odudu node dist/main.js seed user --tenant console-paths \
  --username hopper --password console-paths-throwaway-2 --email hopper@example.com
```

```
{"command":"tenant","created":true,"tenant":"console-paths","tenantId":"01a0e72d-5927-73c3-b14d-a5b60d1ca9ad"}
{"command":"user","tenant":"console-paths","tenantId":"01a0e72d-5927-73c3-b14d-a5b60d1ca9ad","username":"grace","userSubjectId":"01a0e72d-5ba9-78cd-b877-7ea6d4076028"}
{"command":"grant-role","tenant":"console-paths","tenantId":"01a0e72d-5927-73c3-b14d-a5b60d1ca9ad","username":"grace","role":"odudu-admin:tenant-admin"}
{"command":"user","tenant":"console-paths","tenantId":"01a0e72d-5927-73c3-b14d-a5b60d1ca9ad","username":"hopper","userSubjectId":"01a0e72d-7fc7-7950-a1e7-1d079588f8b4"}
```

`grace` is the administrator; `hopper` is there so that a list has a second
page. The sections are in the order they ran, one curl cookie jar (`jar`)
throughout, so each section's cookies are the ones the section before it set.

Two sections come from **a second run**, twenty minutes after the first, on
the same container and tenant, with a new, empty `jar` and a new sign-in: the
refused callbacks and the path that escapes `/admin/`. Each says so in its
first line.

Three sections come from **an eighth run**, on a stack of its own built from
the branch tip at the close of the console's features: the `infra/docker`
compose file as the project `odudu-docs-18a`, on `http://localhost:3185`, its
`odudu` service built from the tree the document describes, on an empty
volume, with a console key made for it by `infra/docker/console-key.sh`.
It is where the `PATCH`, the cross-site refusals and the principal refusal
ran, one after another on one session, with a throwaway tenant,
`console-paths`, holding `grace` as its administrator and `hopper` beside her.
`grace` signed in through the same four steps the first run shows, with a new,
empty `jar`. The seed printed:

```bash
docker compose -p odudu-docs-18a exec -T odudu node dist/main.js seed tenant --name console-paths
docker compose -p odudu-docs-18a exec -T odudu node dist/main.js seed user --tenant console-paths \
  --username grace --password console-paths-throwaway --email grace@example.com
docker compose -p odudu-docs-18a exec -T odudu node dist/main.js seed grant-role --tenant console-paths \
  --username grace --role odudu-admin:tenant-admin
docker compose -p odudu-docs-18a exec -T odudu node dist/main.js seed user --tenant console-paths \
  --username hopper --password console-paths-throwaway-2 --email hopper@example.com
```

```
{"command":"tenant","created":true,"tenant":"console-paths","tenantId":"01a13ff2-eddb-7d89-8555-c32d1cd8acf9"}
{"command":"user","tenant":"console-paths","tenantId":"01a13ff2-eddb-7d89-8555-c32d1cd8acf9","username":"grace","userSubjectId":"01a13ff2-eff9-746c-b8cb-e56af2072daa"}
{"command":"grant-role","tenant":"console-paths","tenantId":"01a13ff2-eddb-7d89-8555-c32d1cd8acf9","username":"grace","role":"odudu-admin:tenant-admin"}
{"command":"user","tenant":"console-paths","tenantId":"01a13ff2-eddb-7d89-8555-c32d1cd8acf9","username":"hopper","userSubjectId":"01a13ff2-f33a-79ce-a952-0aeec04a80d4"}
```

The gateway refuses a write naming no subject in `X-Odudu-Console-Subject`, so
every write in those three sections names `grace`'s, and the principal
refusal shows the refusal beside the same write forwarded.

One section comes from **a fifth run**, on a stack of its own, the project
`odudu-signin` on `http://localhost:3082` at `0824c4e7`: the restarted
callback. It says what it seeded in its first lines.

One response comes from **a sixth run**, after the pending sign-in's window
was raised: `GET /console/auth/login` says which.

**A seventh run** follows `odudu-admin` becoming a confidential client, which
is what the gateway now signs in as: a stack of its own, the project
`odudu-docs-12b` on `http://localhost:3082`, its `odudu` service built from
commit `b4efbb72` on an empty volume, with a console key made for it by
`infra/docker/console-key.sh`. `seed admin --username ada` made the `system`
tenant's administrator, who signed in to the console with a new, empty `jar`.
Every section that makes a token, refresh or revocation call ran on it, and
each says so in its first line: [the gateway is a confidential
client](./the-gateway-is-a-confidential-client.md), the first block of the
discovery read, [a refresh](./a-refresh.md), [a refresh that cannot take the
lock](./a-refresh-that-cannot-take-the-lock.md), [a refresh the server
refuses](./a-refresh-the-server-refuses.md), and the logout with the redirect it
ends on. Their audit rows answer `actor_name` and `actor_origin`.
