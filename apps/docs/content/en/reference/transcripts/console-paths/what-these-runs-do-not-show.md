---
title: 'What these runs do not show'
description: 'The console gateway behaviours that are covered by tests and were not captured against a running stack.'
---

# What these runs do not show

Each item below is tested, not captured:

- **A read naming another subject**, refused `409` like a write, and the
  refusal of a session another sign-in in the same browser replaced. These
  are in `apps/server/tests/console-proxy.int.test.ts`.
- **The `502` on a token-endpoint failure.** A healthy stack's token
  endpoint answers a live grant's refresh, so this needs a fault injected
  into it. It is in `apps/server/tests/console-proxy.int.test.ts`.
- **The admin API's own `401`**, confirmed against the session's own tenant
  with a `whoami`, ending the session and revoking its grant only when that
  confirm is also a `401`, and passed through with the session kept for an
  unknown tenant or another tenant's path. These are in
  `apps/server/tests/console-proxy.int.test.ts`.
- **An assertion signed with a key no tenant registers, or naming another
  tenant's token endpoint**, redeeming a code: refused `invalid_client`, and
  the code stays good. It is in
  `apps/server/tests/console-client-authentication.int.test.ts`.
- **The `__Host-` cookies**, which need an `https` base. These are in
  `apps/server/tests/console-session.int.test.ts`, and the `conformance`
  job's `infra/conformance/run-console-check.sh` asserts both over that
  stack's TLS proxy ([its README](https://github.com/wizzywit/odudu/blob/main/infra/conformance/README.md#the-console-over-https)).
