---
title: 'What these runs do not show'
description: 'The console gateway behaviours that tests cover and that no recorded run on a running stack shows.'
---

# What these runs do not show

Each item below is tested, not captured:

- **A read naming another subject**, refused `409` like a write, and the refusal
  of a session another sign-in in the same browser replaced. An integration test
  covers these.
- **The `502` on a token-endpoint failure.** A healthy stack's token
  endpoint answers a live grant's refresh, so this needs a fault injected
  into it. An integration test covers it.
- **The admin API's own `401`**, confirmed against the session's own tenant
  with a `whoami`, ending the session and revoking its grant only when that
  confirm is also a `401`, and passed through with the session kept for an
  unknown tenant or another tenant's path. An integration test covers these.
- **An assertion signed with a key no tenant registers, or naming another
  tenant's token endpoint**, redeeming a code: refused `invalid_client`, and
  the code stays good. An integration test covers it.
- **The `__Host-` cookies**, which need an `https` base. An integration test
  covers these, and the `conformance` job asserts both over the stack's TLS
  proxy ([its
  README](https://github.com/wizzywit/odudu/blob/main/infra/conformance/README.md#the-console-over-https)).
