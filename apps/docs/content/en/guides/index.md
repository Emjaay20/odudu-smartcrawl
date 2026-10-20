---
title: Guides
description: Sign users in from a web app, a single-page app, an API or a machine.
---

# Guides

Sign users in from a web app, a single-page app, an API or a machine.

## The journeys

Read these in order. Each shows trimmed pieces of a real run and links to the full recording.

1. [Sign a user in](./sign-a-user-in.md): send a person to Odudu and get tokens back.
2. [Refresh and end a session](./refresh-and-end-a-session.md): keep a person signed in, catch a stolen refresh token and sign them out.
3. [An admin signs in and changes a user](./admin-signs-in-and-changes-a-user.md): sign in to the console and make a safe change.
4. [Read a refusal](./read-a-refusal.md): what an error looks like and why it happened.

## Pick the one for what you are building

- **A single-page app or a mobile app.** It has no secret to keep, so it is a public client. Start with [Sign a user in](./sign-a-user-in.md), which uses one.
- **A web app with a server.** It keeps a secret, so it is a confidential client and proves who it is when it swaps the code. The flow is the same; see [Path A as a confidential client](../reference/transcripts/request-paths/path-a-as-a-confidential-client.md).
- **An API.** It receives access tokens and checks them. Sign a user in to get one, then see [token introspection and revocation](../reference/transcripts/request-paths/rp-initiated-logout.md#token-introspection-and-revocation).
- **A machine or a service.** No person signs in. See [client credentials](../reference/transcripts/request-paths/path-c-client_credentials.md), and [token exchange](../reference/transcripts/request-paths/path-d-token-exchange.md) for acting on behalf of someone.

<!-- filled by Increment 24 -->
