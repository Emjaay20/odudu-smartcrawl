---
title: Disclosure
description: How to report a security problem in Odudu privately, and what to expect after you do.
---

# Disclosure

You think you have found a flaw in Odudu. Tell us privately first, so it can be fixed before it is public.

## 1. Report it privately

Use GitHub's [private vulnerability reporting](https://github.com/wizzywit/odudu/security/advisories/new). It reaches the maintainer and nobody else. Please do not open a public issue for a security flaw.

If private reporting is not available to you, the repository's [security policy](https://github.com/wizzywit/odudu/blob/main/SECURITY.md) gives another way to reach the maintainer.

## 2. Say how to reproduce it

Include what is needed to make the problem happen again: the endpoint or part of the product, the request or setting that triggers it, and what an attacker gains. A short reproduction is worth more than a long description.

## 3. What happens next

Odudu is a personal project maintained in bursts, so replies are best effort, not a contract. You can expect an acknowledgement, an assessment of how serious it is, and credit in the fix unless you would rather not be named.

## What is in scope

Anything in the repository: the server, the admin API and console, the container and compose files, and the build configuration. The parts most likely to be subtly wrong, and so the most welcome reports, are token issuance and refresh rotation, tenant isolation (any path that reaches the database without a tenant), and signing key handling.

A finding that only holds when a deployment ignores [Hardening](../operating/hardening.md), for example by running without TLS in front, is not a flaw in Odudu. A report that the guides or this site tell a reader to do something unsafe is.

[The security policy](https://github.com/wizzywit/odudu/blob/main/SECURITY.md) in the repository is the source of record for all of this, and what it says wins if the two ever differ.

Read [the threat model](./threat-model.md) first if you want to know what we already count as a limit.
