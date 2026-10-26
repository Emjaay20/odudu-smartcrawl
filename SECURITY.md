# Security policy

## Reporting a vulnerability

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/wizzywit/odudu/security/advisories/new).
Please do not open a public issue for a security flaw.

If private reporting is not available to you, email
wisdompraise968@gmail.com with `[odudu security]` in the subject.

Say what is needed to reproduce it: the endpoint or component, the request or
configuration that triggers it, and what an attacker gains.

## Supported versions

Odudu is before 1.0. Only the latest release is supported, and a fix goes into
the next release. Earlier releases do not get patches.

## What to expect

One person maintains Odudu, in bursts, so times are best effort. You will get
an acknowledgement, an assessment of how serious it is, and credit in the fix
unless you prefer not to be named.

Odudu has not had a security review yet, so findings now are welcome. Fixing a
flaw while the design is still cheap to change costs less than fixing it later.

## Scope

In scope: anything in this repository, including the provider, the admin
surface, the console, the container and compose files, and the CI
configuration.

The parts most likely to be subtly wrong:

- token issuance, validation and refresh rotation
- tenant isolation, including any path that reaches the database without a
  tenant context
- signing key handling and rotation
- sessions, cookies and logout
- second factors and recovery codes

Odudu is a release candidate and has not had an independent security review,
as the [README](README.md) says.

Out of scope: findings that depend on a deployment that switches off a boot
guard or ignores the [production settings](apps/docs/content/en/operating/configuration.md).
