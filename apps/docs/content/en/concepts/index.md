---
title: Concepts
description: Tenants, clients, tokens, sessions and the other ideas the product is built on.
---

# Concepts

Tenants, clients, tokens, sessions and the other ideas the product is built on.

Each idea below is short, and links to the guide step where you meet it.

## Tenant

A tenant is one organisation's own space in Odudu. It has its own users, clients, signing keys and sessions, kept apart from every other tenant's. The tenant is part of every address, as in `/tenants/demo/`, so a request can never be mistaken for another tenant's. You meet it in [Sign a user in](../guides/sign-a-user-in.md#1-find-the-endpoints).

## Client

A client is an app registered with a tenant. It has a `client_id` and a list of redirect addresses it may use. A **public** client, such as a single-page app, holds no secret. A **confidential** client, such as a web app's server, does, and proves it. Every client uses PKCE.

## Tokens

An **access token** is what you send to an API. In the examples it lives 300 seconds. An **ID token** says who signed in. A **refresh token** gets new tokens later, and each one works once. See [Sign a user in](../guides/sign-a-user-in.md#5-swap-the-code-for-tokens) and [Refresh and end a session](../guides/refresh-and-end-a-session.md).

## Session

When a person signs in, Odudu sets a session cookie. A session ends when it has been idle too long or has lasted too long, whichever comes first, or when it is ended on purpose, as in [Refresh and end a session](../guides/refresh-and-end-a-session.md#3-end-the-session).

## Refusal

When Odudu says no it tells a person, a client or an admin tool in the way each can use. [Read a refusal](../guides/read-a-refusal.md) shows seven of them.

<!-- filled by Increment 25 -->
