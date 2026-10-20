---
title: 'DELETE /subjects/:id'
description: 'Requires manage-users. Removes the subject; every table that names one (users, user_credentials, sessions, token_grants, subject_roles, …) cascades…'
---

## `DELETE /subjects/:id`

Requires `manage-users`. Removes the subject; every table that names one
(`users`, `user_credentials`, `sessions`, `token_grants`,
`subject_roles`, …) cascades, except a client whose service account named
it — `clients_service_subject_fk` (`packages/db/drizzle/0063_service_subject_fk.sql`)
detaches the client (`service_subject_id` goes `null`) rather than failing
or deleting it. An unknown id answers `404`, and a subject holding an admin
capability the caller does not is refused with `403`
([the target ceiling](./post-subjectsidpassword.md#the-target-ceiling)).
