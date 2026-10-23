---
title: 'GET /subjects/:id/credentials'
description: "Requires view-users. Metadata only — type, created_at, and, for a password credential, whether it is expired under the tenant's password_max_age_days."
---

# `GET /subjects/:id/credentials`

Requires `view-users`. Metadata only — `type`, `created_at`, and, for a
`password` credential, whether it is expired under the tenant's
`password_max_age_days`. Never a hash, never `secret_data`: the response is
built from an explicit field list, so a column added to `user_credentials`
later is absent by default rather than exposed by default.
`recovery-code` rows are collapsed into one entry carrying
`recovery_code_count` — ADR 0021 keeps a spent code's row, so a per-row
listing would answer "how many were ever issued" rather than "how many
still work"; that entry carries no `id`, since it names no single row a
caller could delete — [`DELETE /subjects/:id/recovery-codes`](./delete-subjectsidrecovery-codes.md)
revokes the set whole. `password-history` never appears: it is not a
credential a caller reads or deletes.

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/subjects/01a0d6fd-9453-7bf0-9823-a5fc6ea34836/credentials
```

Against `ada`, created through `POST /subjects` above, the list is empty —
and that is the rule the section states, seen from outside: a subject this
API creates has no password to list, only the `update-password` action
waiting for one.

```
{"items":[]}
```
