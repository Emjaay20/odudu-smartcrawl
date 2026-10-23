---
title: Reference
description: Endpoints, configuration, commands, error codes and events, looked up by name.
---

# Reference

Endpoints, configuration, commands, error codes and events, looked up by name.

Most of this reference is generated from the code that does the work, so it lists what the version you
run does and cannot fall behind it. The pages say which source they were generated from. If you would
rather follow a journey than look something up, the [guides](../guides/index.md) come first.

## Protocol, configuration, commands, errors and events

- [Protocol in plain words](./protocol.md): the discovery document, the endpoints and the parameters each takes.
- [Configuration](./generated/configuration.md): every environment variable, with its type,
  bounds and default.
- [Command line](./generated/cli.md): `odudu init`, `seed`, `reap` and the other commands. `odudu help` lists them, and `odudu help seed client` shows the options of one.
- [Endpoints](./generated/endpoints.md): everything the server serves, and how each endpoint
  authenticates.
- [Error codes](./generated/errors.md): admin API problem types, OAuth errors and the errors
  a command stops with.
- [Audit events](./generated/events.md): the event types, actions and reasons the audit trail
  records.

## What is not there yet

The [roadmap](../roadmap.md) lists every gap, the phase that brings it, and the decisions that mean a thing is left out on purpose.

## Admin API

The operations of the admin API, one page for each area. The same description is published as an
[OpenAPI document](pathname:///openapi/admin.json) that a client generator can read.

- [Admin API overview](./generated/admin-api/index.md): authentication, the tenant in the path and
  the shape of an error.
- [Audit](./generated/admin-api/audit.md)
- [Clients](./generated/admin-api/clients.md)
- [Flow](./generated/admin-api/flow.md)
- [Groups](./generated/admin-api/groups.md)
- [Keys](./generated/admin-api/keys.md)
- [Lockouts](./generated/admin-api/lockouts.md)
- [Mail](./generated/admin-api/mail.md)
- [Registration tokens](./generated/admin-api/registration-tokens.md)
- [Roles](./generated/admin-api/roles.md)
- [Scopes](./generated/admin-api/scopes.md)
- [Sessions](./generated/admin-api/sessions.md)
- [Settings](./generated/admin-api/settings.md)
- [SMTP](./generated/admin-api/smtp.md)
- [Subjects](./generated/admin-api/subjects.md)
- [Tenants](./generated/admin-api/tenants.md)
- [Whoami](./generated/admin-api/whoami.md)

## Transcripts

The full, recorded runs behind the guides, with every request and the response that came back.

- [Request paths](./transcripts/request-paths/index.md): sign-in, tokens, sessions, logout and
  the refusals each can end in, one page for each journey.
- [Admin paths](./transcripts/admin-paths/index.md): the admin API route by route, with the
  response each one answers.
- [Console paths](./transcripts/console-paths/index.md): the routes the admin console signs in
  and forwards its calls through.

All three are listed on the [Transcripts](./transcripts/index.md) page.
