---
title: 'Admin paths'
description: 'The admin API: the endpoints under /admin/tenants/{tenant}/ that let an operator manage a tenant instead of reaching for psql.'
---

# Admin paths

The admin API: the endpoints under `/admin/tenants/{tenant}/` that let an
operator manage a tenant instead of reaching for `psql`.

Three artifacts describe this API and each has one job. The published
OpenAPI document, served unauthenticated at `/admin/openapi.json`, is the
**reference** — generated, and the place every endpoint and every field is
listed exhaustively. This document is the **narrative** — an operator's
journey through a task, in the order they would actually hit it, with the
shape of each request and, once a live stack has been brought up to capture
it against, the real response. [README.md](https://github.com/wizzywit/odudu/blob/main/README.md) is the **entry
point** — how to get a token that can call any of this at all.

There is one "What is not implemented" list for the whole server, and it
stays in [docs/request-paths.md](https://github.com/wizzywit/odudu/blob/main/docs/request-paths.md#what-is-not-implemented);
this document never starts a second one. An admin endpoint that does not do
yet what its name suggests says so in its own section below, and points at
that list rather than duplicating it.

Every transcript below is captured output, and follows the same discipline
as [docs/request-paths.md](../protocol/index.md): a fenced block holding a
response carries no language tag, a section whose output depends on the
state of the stack it ran against says which state, and a precondition a
refusal depends on is shown rather than asserted.

**Reproducing a run that signs in repeatedly.** Several stacks below are
described as started with `ODUDU_THROTTLE_LIMIT=1000` (or `10000`) so a
scripted run of sign-ins is not refused. Those captures pre-date the
per-username sign-in budget, which refuses a sixth submission naming one
username from one address inside a minute
([ADR 0023](https://github.com/wizzywit/odudu/blob/main/docs/adr/0023-brute-force-authority-is-split.md)); to run any of them
again, start the stack with `ODUDU_LOGIN_THROTTLE_LIMIT=1000` as well. The
transcripts themselves are unchanged.

**The stack.** One run of `infra/docker/compose.yaml`, brought up from an
empty volume, with `odudu seed admin --username ada` run against it and a
tenant named `demo` created through `POST /admin/tenants` below. The
sections are in the order they were executed, so the ids, secrets, `ETag`s
and timestamps in them are one run's real ones and refer to each other:
`demo` is `01a0d6fc-3626-7e23-94d7-3b1b666e278f`, `ada` in the `system`
tenant is subject `01a0d6fb-0918-7846-b430-0a714b8bf7bf`. Secrets shown
here are that stack's, and it was torn down with `docker compose down -v`
when the capture finished.

**The second stack.** The sections that turn on `If-Match` being
mandatory, and the tenant and SMTP sections that describe endpoints added
after the first capture, ran against a second stack brought up the same
way from an empty volume: `seed admin --username ada`, then `demo` created
through `POST /admin/tenants`, then a subject `grace`, a role
`billing-viewer`, a group `engineering` and a scope `billing` created
through the endpoints below. Its `demo` is
`01a0d7ee-b611-71a0-b223-5a57ecbe83d8` — a different run, so its ids,
`ETag`s and timestamps refer to each other and to nothing in the sections
above. Each such section says so. It was torn down the same way.

**The third stack.** "Getting the token" was captured again, after the
session cookie gained its secret (`0071_session_secret.sql`), against a
stack brought up the same way from an empty volume with only
`seed admin --username ada` run against it. Its password, ids, code and
cookie are that run's own: its `ada` is
`01a0de12-c116-70ee-9cc1-984429980dcc`, not the subject the sections after
it name. "Getting the token" has since been captured once more, on a stack of
its own, and says so.

**The fourth stack.** "Getting the token"'s final probe and `GET /whoami`
were recaptured together (the first has since been captured again with the
rest of that section), after `whoami` started answering `capabilities`
and `crossTenant`, against this branch's own already-running development
stack rather than a fresh one — it was not brought up for this capture and
was not torn down afterward. It carries a tenant also named `demo`, under
its own id, `01a0db22-1c32-7d17-b351-697d7911033c` — a different tenant
from the one the sections above and below this note refer to by that same
name. `seed admin --username ada-whoami` run against it created the
subject behind the `GET /whoami` probe, `01a0e0a7-0ead-703a-ab34-22bcf5167d46`, rather
than reusing the existing `ada` whose password from this stack's own
history is not known here; its capabilities come from holding
`tenant-admin`, which composites every capability plus `manage-tenants`
(the same account "Getting the token" describes `ada` as). The searches
under `GET /subjects` and the two refusals under `POST /subjects` were
captured against it later, as `ada-whoami`, after its `odudu` service was
rebuilt from this branch; the searches under `GET /admin/tenants` and
`GET /clients` after a further rebuild that applied `0074`; and those under
`GET /roles`, `GET /groups`, `GET /scopes` and `GET /keys` after one that
applied `0075`, against roles and groups created in `demo` for them
through the endpoints below, as each of those sections shows (the role and
group ones, and the composites and defaults after them, have since been
recaptured on the fourteenth stack, and say so). The counts
under `GET /admin/tenants/count` were captured against it after a further
rebuild, as that section says. The memberships under `GET /subjects/:id/groups` were captured
against it after one more rebuild, in a tenant of their own, as that
section says. So were the composites under `GET /roles/:id/composites` and
the defaults under `PUT /roles/:id/default`, after a further rebuild, in a
tenant `composites-demo`. `DELETE /scopes/:id/clients/:clientId` was
captured against it after one more rebuild, as a new admin subject
`ada-scope-unassign`, in a tenant `scope-unassign-demo` created for it; its
built-in admin client guard and `DELETE /scopes/:id`'s `openid` guard were
captured together after a further rebuild, as the same subject, in a
tenant `scope-guard-demo` created for them. `GET /subjects/:id/profile`
and `PATCH /subjects/:id/profile` were captured after one more rebuild, as
a new admin subject `ada-profile` in the system tenant, in a tenant
`profile-demo` created for them, on a subject `grace` created there; the
same section was recaptured after a further rebuild fixed the write-order
and locking review found in it, as the same `ada-profile`, in a fresh
tenant `profile-demo2`, on a new subject also named `grace`; the two
resubmit-the-same-number calls at the end of it were added after one more
rebuild narrowed the reset rule to a different number, against that same
`profile-demo2` tenant and subject, continuing where the recapture left
off. `GET /subjects/:id/consents` and `DELETE /subjects/:id/consents/:clientId`
were captured after a further rebuild, as a new admin subject
`ada-consents2` in the system tenant, in a tenant `consents-demo2` created
for it, on a subject `grace` seeded there with `odudu seed user` and a
confidential client `consents-demo-app2` created with `consent_required`
— recaptured entirely, under this tenant, after a further rebuild made
`DELETE` also revoke the subject's grants against the client.
`DELETE /subjects/:id/lockout`, `DELETE /subjects/:id/sessions` and
`POST /subjects/:id/password` were captured in that order after one more
rebuild, with the `odudu` service alone started with
`ODUDU_THROTTLE_LIMIT=1000` (and, to reproduce it now,
`ODUDU_LOGIN_THROTTLE_LIMIT=1000`) so a scripted run of sign-ins is not
refused by the per-origin throttle, as a new admin subject `ada-recovery` in the
system tenant, in a tenant `recovery-demo` created for them, on a subject
`hana` seeded there with `odudu seed user`, and, for the target ceiling,
subjects `mo` and `lin` seeded beside it. The service was restarted
without that override afterwards, so the stack is back to its default
throttle of ten. The `demo-fields-check` create and read under
`POST /clients` were recaptured after a further rebuild added
`builtin_admin` and `service_subject_id` to a client's representation, as
`field-facts-admin`, a new admin subject in the system tenant — the client
was deleted and recreated under the same `client_id` in `demo`, so its row
id, secret and timestamp are later than the rest of this section's.
`GET /settings` and `PATCH /settings`, and the rename under
`PATCH /subjects/:id`, were recaptured after one more rebuild that applied
`0077_username_editable.sql`, as a new admin subject `ada-rename` in the
system tenant, in tenants `settings-demo` and `rename-demo` created for
them, as each section says. `GET /export` was captured after one more
rebuild, as a new admin subject `ada-export`, in a tenant `export-demo`
created for it, as that section says; its audit-trail queries were later
recaptured, scoped by `from=$RUN_START` instead of left unscoped, as a
further admin subject `ada-export2` against that same tenant, without
rebuilding the stack. `POST /admin/tenant-imports` was captured after one
more rebuild, as a new admin subject `ada-import`, from a tenant
`import-source` created for it into a tenant `import-demo`, as that
section says; its own unscoped audit-trail query was later recaptured,
scoped by `resource_type`/`resource_id`, as a further admin subject
`ada-import2` importing into a new tenant `import-demo2` from the same
`import-source`, again without rebuilding the stack. The range refusals
under `PATCH /settings` were captured after a further rebuild, as the same
`ada-import`, in a tenant `settings-range-demo`; the rest of that section
was not re-run.

**The fifth stack.** The sections this note names were captured against a
stack of their own: compose project `odudu-task2`, published on port 3080,
built from this branch and brought up from an empty volume with
`seed admin --username ada-t2`, each section after a rebuild that added
what it describes. It was torn down with `docker compose down -v` when the
capture finished. They are "A refusal names its field", the `ETag`
sections under scope assignment and signing keys, `GET /scopes/:id/clients`,
"Filtering by capability", "The last administrator", "The authenticators a
step may name", "The owning client, by name", and the OpenAPI entry under
`PUT /scopes/:id/clients/:clientId`.

**The sixth stack.** Every transcript whose output changed once a `400`
named its field under `errors`, a create answered its `ETag`, SMTP reported
`effective`, a flow answered `available` and a role named its owning
client was captured again against one more stack (the role and group ones
since recaptured on the fourteenth, and saying so): the same compose project
`odudu-task2` on port 3080, brought up from an empty volume built from this
branch, with `seed admin --username ada` run against it and every tenant,
client, role, group, scope and subject a section names created there
through the endpoints below — each section says which. Its `demo` is
`01a0ea4c-0884-74fa-825c-05f6ef568dd0`, a different tenant from the other
stacks' `demo`s. It was torn down with `docker compose down -v` when the
capture finished. A section that says it was captured against it refers
to nothing on the stacks above.

**The seventh stack.** `GET /subjects/:id/lockout` and
`DELETE /subjects/:id/recovery-codes` were captured against a stack of
their own: compose project `odudu-t8` on port 3080, built from this branch
with both routes in it and brought up from an empty volume with
`ODUDU_THROTTLE_LIMIT=1000` (and, to reproduce it now,
`ODUDU_LOGIN_THROTTLE_LIMIT=1000`), so a scripted run of sign-ins is not
refused by the per-origin throttle, and `seed admin --username ada-t8` run against
it. Each of the two sections says what else it seeded. It was torn down
with `docker compose down -v` when the capture finished.

**The eighth stack.** `GET /subjects/username-policy`, the refusal of a
disabled subject's token under "The shape of it", and `GET /admin/openapi.json`
(recaptured since against the twelfth stack, below) were captured against one more stack of their own: compose project
`odudu-t8b` on port 3080, built from this branch and brought up from an
empty volume, with `seed admin --username ada-t8b` run against it, then a
tenant `policy-demo` made with `odudu seed tenant` and a subject `vera`
seeded there with `odudu seed user` and granted `odudu-admin:view-users`
alone. `$VERA_TOKEN` is `vera`'s own admin access token, got the way
"Getting the token" shows but at `policy-demo`. It was torn down with
`docker compose down -v` when the capture finished.

**The tenth stack.** The sections on routes added for the operator's side of a
tenant — its sessions and grants, its mail and logout deliveries, bulk and
tenant-wide writes, claim evaluation, audit reporting and tenant deletion — the
older `GET /audit` transcripts their notes say were recaptured, and in
[docs/request-paths.md](../protocol/index.md) "One sign-in's audit trail" and the
back-channel logout queue's `attempts`, ran against one more stack: compose
project `odudu-t8b2` on port 3082, its Postgres on 5464, built from this branch
at `a66cf8df` and brought up from an empty volume with
`ODUDU_OUTBOX_ENABLED=false` and `ODUDU_LOGOUT_SENDER_ENABLED=false`, so that
mail and Logout Tokens leave only when `odudu send-mail` and `odudu
send-logouts` are run by hand, `ODUDU_ALLOW_PRIVATE_SMTP_HOSTS=true` and
`ODUDU_ALLOW_PRIVATE_CLIENT_URLS=true`, so that a relay and a logout endpoint
can name the stack's own `postgres` container, where nothing listens and so
every delivery fails, and `ODUDU_THROTTLE_LIMIT=1000`. Against it: `seed admin
--username ada-t8b2` in `system`, a tenant `ops-demo` made through `POST
/admin/tenants`, subjects `grace` (with an address), `linus` (without), `mona`,
`sam` and `uma` seeded there with `odudu seed user`, `mona` granted
`odudu-admin:manage-tenant`, `sam` `odudu-admin:manage-sessions` and `uma`
`odudu-admin:manage-users`, and a confidential client `ops-app` made through
`POST /clients` with a back-channel logout URI of
`https://postgres:9/backchannel`, row id `01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123`.
`grace` then signed in through `ops-app` twice — once asking for
`offline_access` — and `linus` once. `$ADMIN_TOKEN` is `ada-t8b2`'s token, got
fresh for each section the way "Getting the token" shows, and
`P=http://localhost:3082/admin/tenants/ops-demo` throughout. Each section says
what else it seeded. The two rename refusals, `GET /admin/openapi.json` (since
recaptured against the twelfth stack), `ivy`'s
read under `GET /audit` and the back-channel logout queue ran last, on the image
rebuilt at `1507a6c3`, whose only change is the wording of the
`about:blank#logout-deliveries-pending` detail. The stack was torn down with
`docker compose down -v` when the capture finished. `DELETE
/admin/tenants/{tenant}` was captured again at the close of P4d, on a stack of its own,
as its section says.

**The twelfth stack.** Every transcript whose output changed once groups and
roles carried a `description` (the role and group ones since recaptured on the
fourteenth, and saying so), groups `default_for_new_subjects`, scopes
their client default and consent fields, a tenant `audit_event_types`, a
client the fields `0084` to `0086` added and `odudu reap` its `cleared`
report, and the sections on the routes and settings those changes added,
ran against one more stack: compose project `odudu-t8c2` on port 3082, its
Postgres on 5464, built from this branch at `15cdb46a` and brought up from
an empty volume with `ODUDU_OUTBOX_ENABLED=false`, `ODUDU_REAP_ENABLED=false`
and `ODUDU_LOGOUT_SENDER_ENABLED=false`, so that mail leaves and `reap` runs
only when run by hand, `ODUDU_ALLOW_PRIVATE_SMTP_HOSTS=true`,
`ODUDU_ALLOW_PRIVATE_CLIENT_URLS=true` and `ODUDU_THROTTLE_LIMIT=1000`, with
`seed admin --username ada-t8c2` run against it. `$ADMIN_TOKEN` is
`ada-t8c2`'s, got fresh for each section the way "Getting the token" shows.
Every tenant, client, role, group, scope and subject a section names was
created there for it through the endpoints below, each section says which,
so its ids refer to nothing on the stacks above. It was torn down with
`docker compose down -v` when the capture finished. The required-actions
transcripts under `POST /subjects/:id/actions-email` and in
[docs/request-paths.md](../protocol/following-a-required-actions-link.md),
and the audit types under `GET /audit`, ran on a later stack: compose project `odudu-t8d2` on port 3086, its Postgres
on 5466, built at `6feb06b7` and brought up from an empty volume with
`ODUDU_OUTBOX_ENABLED=false`, `ODUDU_REAP_ENABLED=false` and
`ODUDU_THROTTLE_LIMIT=1000`, with `seed admin --username ada` run against it. The
tenant `required-actions-demo` and its client `actions-app` came from `odudu seed
--tenant required-actions-demo --client actions-app --redirect-uri
https://app.example/callback --user seeder`; it was torn down with `docker
compose down -v` when the capture finished.

**The fourteenth stack.** Every transcript that shows a role or a group
answer ran against one more stack, once each such answer carried `admin_reach`,
a group's own record `subtree_admin_reach` and `holds_default_group`, and each
role in a group's roles its own `admin_reach`: compose project `odudu-t10b` on
port 3082, its Postgres on 5464, built from this branch at `539ffd7a` and
brought up from an empty volume with `ODUDU_THROTTLE_LIMIT=1000`,
`ODUDU_OUTBOX_ENABLED=false`, `ODUDU_REAP_ENABLED=false` and
`ODUDU_LOGOUT_SENDER_ENABLED=false`. Against it: `seed admin --username
ada-t10b`, then a subject `ada-sys` seeded in `system` with a password and
granted `odudu-admin:tenant-admin`, whose own admin token, got the way "Getting
the token" shows, is `$ADMIN_TOKEN` throughout. Every tenant, client, role,
group and subject a section names was made there for it through the endpoints
below, `seed client` and `seed user`, and each section says which, so the ids in
them refer to nothing on the stacks above. The transcripts that show audit rows,
counts and the answers to a subject's roles carry no role or group record and
stay on the stacks they were captured against. It was torn down with
`docker compose down -v` when the capture finished.

**The fifteenth stack.** Every transcript about a client's service account reach, the exact
lookup and the 200-entry bound under `GET /clients`, `PATCH /clients/{id}`
and [docs/request-paths.md](../protocol/bootstrap.md#dynamic-client-registration) ran
against one more stack: compose project `odudu-tx` on port 3082, its Postgres
on 5464, built from this branch at `3cf8eceb` with the changes those sections
describe, from an empty volume. Against it: `seed admin --username ada`, whose
token, got the way "Getting the token" shows, is `$ADMIN_TOKEN`; a tenant
`client-reach-demo` made through `POST /admin/tenants`, `$P` being
`http://localhost:3082/admin/tenants/client-reach-demo`; and in it a
confidential client `billing` made through `POST /clients`, row id
`01a11113-6605-7a86-baa1-1f49b57fb240`, with one redirect URI. Rows a section
writes by `psql`, which no route does, say so. It was torn down with `docker
compose down -v` when the capture finished.

**The sixteenth stack.** The transcripts about the 200-scope bound under `PUT
/scopes/{id}/clients/{clientId}`, `POST`/`PATCH /scopes`, `POST /admin/tenant-imports`
and `odudu seed assign-scope` ran against one more stack: compose project
`odudu-tx` on port 3082, its Postgres on 5464, built from this branch at
`1b3ad4cd` from an empty volume, with `ODUDU_THROTTLE_LIMIT=1000`. Against it:
`seed admin --username ada4`, whose token, got the way "Getting the token" shows,
is `$ADMIN_TOKEN`; a tenant `scope-limit-docs` made through `POST /admin/tenants`,
`$P` being `http://localhost:3082/admin/tenants/scope-limit-docs` and `$A` the
same without the tenant; in it a public client `limit-app` made through `POST
/clients`, row id `$CID` (`01a11266-76cd-7f4f-81a8-3e9b76d5b1b4`); and scopes
`reports:read` (`$SID`, `01a11266-7838-7db8-9c08-e5c64a8cf4d7`) and `late` made
through `POST /scopes`. The scopes the sections add to reach the limit were
written by `psql`, which no route does, and say so. It was torn down with
`docker compose down -v` when the capture finished.

**The eighteenth stack.** The transcripts under `GET`/`PUT /scopes/:id/roles` and
`GET`/`PUT /scopes/:id/mappers`, once a scope's roles carried `admin_reach` and its
mappers `declared`, ran against one more stack: compose project `odudu-tx` on
port 3082, its Postgres on 5464, built from this branch at `95941669` from an
empty volume, with `ODUDU_THROTTLE_LIMIT=1000`. Against it: `seed admin
--username ada`, whose token, got the way "Getting the token" shows, is
`$ADMIN_TOKEN`; a tenant `scope-reach-demo` made through `POST /admin/tenants`; in
it a scope `billing`, made through `POST /scopes`, and a role `billing-viewer`,
made through `POST /roles`. It was torn down with `docker compose down -v` when
the capture finished.

**The seventeenth stack.** "Getting the token" and the three sections after it
(the admin client itself, converting a public one, rotating the console's key)
ran against one more stack: compose project `odudu-docs-12b` on port 3082, its
Postgres on 5464, built from this branch at `b4efbb72` from an empty volume,
with `ODUDU_THROTTLE_LIMIT=10000` and a console key made for it by
`infra/docker/console-key.sh`. Against it: `seed admin --username ada`, whose
token, got the way "Getting the token" shows, is `$ADMIN_TOKEN`; and a tenant
`legacy`, seeded with `ODUDU_CONSOLE=false` so that its `odudu-admin` was public.
[Console paths](../../admin-console/paths/index.md) ran on the same stack, and its seventh run says
what else it holds. It was torn down with `docker compose down -v` when the
capture finished.

**The nineteenth stack.** The five typed refusals of `PUT /flow/executions` ran
against one more stack: compose project `odudu-docs-14` on port 3082, its Postgres on
5464, built from this branch with the typed refusals from an empty volume, with
`ODUDU_THROTTLE_LIMIT=10000` and a console key made for it by
`infra/docker/console-key.sh`. Against it: `seed admin --username ada`, whose token,
got the way "Getting the token" shows, is `$ADMIN_TOKEN`, and a tenant `flow-demo` made
through `POST /admin/tenants`. It was torn down with `docker compose down -v` when the
capture finished.

**The twentieth stack.** The three typed refusals of the signing-key routes ran against
one more stack: compose project `odudu-docs-15` on port 3082, its Postgres on 5464,
built from this branch with the typed refusals and the cut client list from an empty
volume, with `ODUDU_THROTTLE_LIMIT=10000` and a console key made for it by
`infra/docker/console-key.sh`. Against it: `seed admin --username ada`, whose token,
got the way "Getting the token" shows, is `$ADMIN_TOKEN`, and a tenant `key-refusals`
made through `POST /admin/tenants`, `$P` being its `/admin/tenants/key-refusals`. It
was torn down with `docker compose down -v` when the capture finished.

**The twenty-first stack.** The blank display name under every route that writes one ran
against one more stack: compose project `odudu-docs-17` on port 3082, its Postgres on 5464, built
from this branch from an empty volume, with `ODUDU_THROTTLE_LIMIT=10000` and a console
key made for it by `infra/docker/console-key.sh`. Against it: `seed admin --username ada`,
whose token, got the way "Getting the token" shows, is `$ADMIN_TOKEN`, and a tenant
`name-demo3` and `name-demo4` made through `POST /admin/tenants`. It was torn down with
`docker compose down -v` when the capture finished.

**The twenty-second stack.** The audit row of a test send ran against one more stack:
compose project `odudu-docs-18` on port 3082, its Postgres on 5464, built from this
branch from an empty volume, with `ODUDU_THROTTLE_LIMIT=10000` and a console key made
for it by `infra/docker/console-key.sh`. Against it: `seed admin --username ada`, whose
token, got the way "Getting the token" shows, is `$ADMIN_TOKEN`, and a tenant
`smtp-audit-demo` made through `POST /admin/tenants`. It was torn down with
`docker compose down -v` when the capture finished.
