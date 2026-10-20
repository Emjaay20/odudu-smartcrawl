---
title: 'POST /subjects'
description: 'Requires manage-users. Creates a type: "user" subject: the subject itself, its users row and the tenant''s default_for_new_subjects roles — the same…'
---

## `POST /subjects`

Requires `manage-users`. Creates a `type: "user"` subject: the subject
itself, its `users` row and the tenant's `default_for_new_subjects` roles —
the same composition self-registration performs
(`composeUserSubject`, `packages/protocol-admin/src/usecase/subjects.ts`,
shared with `createAccount` in `apps/server/src/app.ts` so the two doors
cannot drift on what "a new subject" means). **There is no `password`
field**, and that is a rule, not an omission: creating a subject through
this door writes an `update-password` required action instead, so no
operator ever handles a user's password, and the created subject cannot
complete a login until an out-of-band channel sets one. A body carrying
`password` is refused with `400` before the usecase ever runs — Zod's
generated schema already sets `additionalProperties: false`.

```bash
curl -sS -D - -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "ada", "email": "ada@example.com"}' \
  http://localhost:3080/admin/tenants/demo/subjects
```

```
HTTP/1.1 201 Created
x-request-id: 01a0ea54-250f-791a-a610-c67bd0c2f3b0
cache-control: no-store
etag: "6d421703daec2dfafa43124a92e862b052fde60549b94a1a3b22285a6d02b126"
content-type: application/json; charset=utf-8
content-length: 157
Date: Mon, 28 Sep 2026 23:22:58 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0ea54-2519-7513-8bf7-c105e0cfd9dd","type":"user","username":"ada","email":"ada@example.com","enabled":true,"created_at":"2026-09-28T23:22:58.200Z"}
```

Captured against the sixth stack, in its `demo`; the `etag` is the one
`GET /subjects/:id` answers for the new subject.

A body carrying `password` and a username already in use, in that order,
against the same stack. The first refusal is the generated schema's,
so its `title` is the framework's generic one rather than a `Bad Request`
the usecase chose — that is what "refused before the usecase ever runs"
looks like from outside:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "ada", "password": "hunter2"}' \
  http://localhost:3080/admin/tenants/demo/subjects
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "ada"}' \
  http://localhost:3080/admin/tenants/demo/subjects
```

```
{"type":"about:blank","title":"Error","status":400,"detail":"body must NOT have additional properties: password","errors":[{"path":"password","message":"must NOT have additional properties"}],"instance":"01a0ea54-2528-7865-9797-ddba85f9256d"}
{"type":"about:blank","title":"Conflict","status":409,"detail":"the username \"ada\" is already in use","instance":"01a0ea54-2532-7ded-a4a1-78972123db93"}
```

A username holding a bidirectional control character (U+202A to U+202E or
U+2066 to U+2069) is refused, and the field error carries the `code`
`bidi_control_refused`. The rule is the same, with the same message and code,
for what a person reads on a page or in a list: a profile name (`name`,
`given_name`, `family_name`, `middle_name`, `nickname`, `preferred_username`), a
tenant's `display_name` (create, import, `PATCH` and settings), a client's
`client_id`, `name`, `client_name` and `description`, a role's or group's `name`
and `description`, and a scope's `description` and `consent_text`; inside an
import document each is reported at its path. LRM, RLM and ALM, which Persian and
Arabic text uses, and plain Arabic or Hebrew, are accepted. A write that changes a
value is refused whenever the new value holds a control; the stored value may
be kept byte-identical, so it can be sent back unchanged with an unrelated
edit, and it is never rewritten. Editing a legacy value while leaving its
control in place is refused: take the control out, or leave the field alone. A creation is checked
by the generated schema, an amendment against the stored value by the usecase.
What is not covered, and why, is in `docs/phases/p4g.md`. These two answers
came from the integration suite's own app
(`packages/protocol-admin/tests/bidi-controls.int.test.ts` makes the requests),
not from a compose stack, because minting an admin token takes the loopback flow
above; `POST` a username ending in U+202E, then `PATCH` a profile's `given_name`
to a value ending in U+2066:

```
{"type":"about:blank","title":"Error","status":400,"detail":"username: must not contain bidirectional control characters (U+202A to U+202E, U+2066 to U+2069)","errors":[{"path":"username","message":"must not contain bidirectional control characters (U+202A to U+202E, U+2066 to U+2069)","code":"bidi_control_refused"}],"instance":"01a152f1-da3b-718b-88d7-1074c1ec32aa"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"given_name: must not contain bidirectional control characters (U+202A to U+202E, U+2066 to U+2069)","errors":[{"path":"given_name","message":"must not contain bidirectional control characters (U+202A to U+202E, U+2066 to U+2069)","code":"bidi_control_refused"}],"instance":"01a152f1-da58-7bab-86fe-2e481040445e"}
```
