---
title: 'DELETE /subjects/:id/credentials/:credentialId'
description: "Requires manage-users. Removes one credential — a TOTP enrolment or a WebAuthn credential, most operationally — so the subject's next login no…"
---

# `DELETE /subjects/:id/credentials/:credentialId`

Requires `manage-users`. Removes one credential — a TOTP enrolment or a
WebAuthn credential, most operationally — so the subject's next login no
longer offers or requires it. Refuses a `password` or `password-history`
row with `409`: a password has its own rotation surface, never a bare
delete, and history is not a credential this door exposes at all. An
unknown id, or one belonging to a different subject, answers `404`, and a
subject holding an admin capability the caller does not is refused with
`403` ([the target ceiling](./post-subjectsidpassword.md#the-target-ceiling)).

**Removing the last TOTP revokes the recovery codes with it.** A
recovery code only stands in for a TOTP code, so a set that outlived its
TOTP would silently work again once the person enrolled a new one, and it
may have left with the lost device. When no TOTP remains after the delete,
passkeys or not, the whole set goes, spent rows too, in the same transaction,
an owed set is dropped, and a second `subject.recovery_codes_revoke` audit row says so in `detail`:
`{"revoked": 10, "reason": "last_factor_removed"}`. A later enrolment finds no
codes and so issues a fresh set. While another TOTP remains the set stays, and
a recovery code, which only a TOTP can use, does not count as a factor. The
credential list's `type` says which of the two a row is. The subject's
row is locked first, so two concurrent removals serialise and exactly one of
them revokes. The subject is also mailed, at the address on file whether or
not it is verified, saying which factor was removed and, if it happened, that
the codes went with it; it carries no link, no code and nothing about the
factor. A subject with no address is not mailed, and the delete is
unaffected; the mail goes to the address on file whether or not it is
verified, because it says nothing a stranger could use beyond the tenant's name
and that an account exists. The query string is strict: a parameter other than
`end_sessions` is refused with `400`, where this door used to ignore one.

**Sessions end only when asked, and then in the same transaction.**
`?end_sessions=true` ends every live session of the subject, with their grants
revoked and their back-channel logouts queued, through the same usecase
[`DELETE /subjects/:id/sessions`](./delete-subjectsidsessions.md) calls, before the
removal commits: the two succeed or fail together, so a removal can never be
reported as failed after the factor is gone. It needs `manage-sessions` as well
as `manage-users` (`403` otherwise, nothing removed), takes only `true` or
`false` (`400` otherwise), and defaults to `false`: whether the factor was lost
or stolen is something only the operator knows. The `subject.credential_delete`
audit row then carries `detail.ended_sessions`, the count, and the sessions
end through their own `session.end_all` and `session.ended` rows. The console's
removal dialog offers it, unticked, when the factor is the last one.

Captured on 2026-10-19 against a stack of its own, project
`odudu-p4g-recovery`, built from this branch on an empty volume, with
`seed admin --username rae` for the token, a tenant `recovery-life`, and in it
a subject `ines` seeded with `seed user` and then given, as the database
owner, a TOTP credential and ten recovery-code rows, the state an enrolment
and its saved set leave. The credentials list first:

```bash
S=http://localhost:3187/admin/tenants/recovery-life/subjects
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/credentials"
```

```
{"items":[{"id":"01a1554b-bd12-7e43-943d-23bad4c55806","type":"password","created_at":"2026-10-19T17:53:09.356Z","expired":false},{"id":"1c0ec1ea-211d-4a02-aace-a5873c04b243","type":"totp","created_at":"2026-10-19T17:53:25.802Z"},{"type":"recovery-code","created_at":"2026-10-19T17:53:26.613Z","recovery_code_count":10}]}
```

Deleting the TOTP enrolment, then the list, then the audit rows for this
subject, newest first, then the mail the outbox holds for her address, with `INES` the subject
`01a1554b-bcf1-7f9e-a1c1-8e090f921cb8` and `TOTP` the credential
`1c0ec1ea-211d-4a02-aace-a5873c04b243` the list showed:

```bash
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/credentials/$TOTP"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/credentials"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3187/admin/tenants/recovery-life/audit?resource_type=subject&resource_id=$INES" |
  python3 -c "
import json,sys
for r in json.load(sys.stdin)['items']: print(json.dumps({k:r[k] for k in ('action','outcome','detail')}))"
docker compose -p odudu-p4g-recovery exec -T postgres psql -U odudu -d odudu -tA -c \
  "select to_address, subject, body_text from email_outbox where tenant_id = (select id from tenants where name = 'recovery-life') order by created_at"
```

```
HTTP/1.1 204 No Content
x-request-id: 01a1554c-2e52-7d1a-b4eb-1d31751585cf
cache-control: no-store
Date: Mon, 19 Oct 2026 17:53:38 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a1554b-bd12-7e43-943d-23bad4c55806","type":"password","created_at":"2026-10-19T17:53:09.356Z","expired":false}]}
```

The delete's answer and the list come first. Then the audit rows, cut to
`action`, `outcome` and `detail` by the filter in the command (each row
carries the actor, request id and address as the other sections show), and the
mail:

```
{"action": "subject.recovery_codes_revoke", "outcome": "allowed", "detail": {"reason": "last_factor_removed", "revoked": 10}}
{"action": "subject.credential_delete", "outcome": "allowed", "detail": {}}
```

```
ines@example.test|A sign-in method was removed from your recovery-life account|An administrator removed the authenticator app from your ⁨recovery-life⁩ account.

Your recovery codes were removed with it, and no longer work.

If you did not expect this, contact your administrator.

--
You received this because a sign-in method on your account at ⁨recovery-life⁩ was changed.
© 2026 Odudu · Powered by odudu
```

The mail block above was captured again on 2026-10-19, after the mail got its
designed shell, on a stack of its own, the compose project `odudu-p4g-mail`,
with the same tenant name, subject name and steps, so it names no id from the
run above; its footer year is that of the moment the mail was queued.

Ending the sessions with the removal was captured on the same project after it
was rebuilt from the commit that made it one request, on a fresh volume, with
the same names (`seed admin --username rae`, tenant `recovery-life`, public
client `life-app`) and so ids of that run, not those above: `ines` signed in
once with her password (a `302` carrying a code, which left one live session),
and was then given, as the database owner, a TOTP credential and ten
recovery-code rows. `INES=01a15574-77e8-7b37-9d44-350fca4ada8c` and
`TOTP=55284e9a-8ea8-40ff-878b-5ea7f2957653`. Her sessions first, a value that
is not `true` or `false` (refused, so nothing changed), the removal with the
sessions ended, her sessions again, and the audit rows for her, cut to
`action`, `outcome` and `detail` by the filter in the command:

```bash
S=http://localhost:3187/admin/tenants/recovery-life/subjects
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/sessions" |
  python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d['items']),'session(s); client_ids',d['items'][0]['client_ids'])"
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/credentials/$TOTP?end_sessions=maybe"
curl -sS -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/credentials/$TOTP?end_sessions=true"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$S/$INES/sessions"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3187/admin/tenants/recovery-life/audit?resource_type=subject&resource_id=$INES" |
  python3 -c "
import json,sys
for r in json.load(sys.stdin)['items']: print(json.dumps({k:r[k] for k in ('action','outcome','detail')}))"
```

The captured run printed only the status line and body of the `400` (the
`grep -E '^HTTP|^\{' | cut -c1-200` it was piped through is not shown above), and dropped
the `date`, `connection` and keep-alive lines of the `204`:

```
1 session(s); client_ids []
HTTP/1.1 400 Bad Request
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/end_sessions must be equal to one of the allowed values","errors":[{"path":"end_sessions","message":"must be equal to one of th
HTTP/1.1 204 No Content
x-request-id: 01a15574-986f-7acd-b2fd-3e31164a4c33
cache-control: no-store

{"items":[]}
{"action": "subject.recovery_codes_revoke", "outcome": "allowed", "detail": {"reason": "last_factor_removed", "revoked": 10}}
{"action": "subject.credential_delete", "outcome": "allowed", "detail": {"ended_sessions": 1}}
{"action": "session.end_all", "outcome": "allowed", "detail": {"ended": 1}}
```

The one session was `session.end_all`'s, and the count is on the removal's own
row as `ended_sessions`. The `400` line is cut at 200 characters in the capture (`cut -c1-200`).
