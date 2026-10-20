---
title: 'POST /subjects/:id/password'
description: "Requires manage-users, and takes no body. An administrator restoring a subject's access never chooses the password: the server generates one — the…"
---

# `POST /subjects/:id/password`

Requires `manage-users`, and takes no body. An administrator restoring a
subject's access never chooses the password: the server generates one — the same
24 random bytes, base64url, that `odudu seed admin` prints
(`generateOneTimePassword`) — replaces the subject's password credential with
its hash, or creates one for a subject who had none, and owes `update-password`,
so the next sign-in with it parks on the change-password page. The password is
in this `201` response's body and nowhere else: never stored in the clear, never
logged (the request logger records a response's status and allowlisted headers,
never its body), and the `subject.password_issue` audit row's `detail` is empty.
An integration test searches every captured log line and every audit row for it.

Three things are done alongside it. **Any lockout is cleared**: an
administrator restoring access is not the attacker a lockout exists to
slow down, and a password nobody can spend helps nobody. **Every
outstanding link that can set the password is retired** — reset links, and
required-actions links naming `update-password` — as a redeemed reset
retires its siblings, so a link mailed before the account was recovered cannot
reopen it. And the change it forces is held to the tenant's password
policy, while the issued password itself is not: the policy governs a
password somebody chooses, and a sign-in only verifies a password against
its hash.

Like a redeemed reset link (`completePasswordReset`), it **ends no session and
revokes no grant**: a subject already signed in somewhere stays signed in there.
**For a compromised account, issue the password and then end every session**
(`DELETE /subjects/:id/sessions`, below). Neither reaches a grant bound to no
session: an `offline_access` refresh token survives both, and is revoked per
client through `DELETE /subjects/:id/consents/:clientId`.

A subject with no `users` row — a service or `agent_instance` subject,
which has no sign-in to restore — answers `404`, the same as an unknown
subject or one in another tenant.

## The target ceiling

**Every route that mutates one subject refuses a caller who does not hold every
admin capability that subject holds.** That is every non-`GET` route under
`/admin/tenants/{tenant}/subjects/{id}`: `PATCH` and `DELETE` on the subject
itself, `PATCH …/profile`, `DELETE …/credentials/{credentialId}`, `DELETE
…/consents/{clientId}`, `POST …/password`, `POST …/password-reset`, `POST
…/verification`, `POST …/actions-email`, `DELETE …/lockout`, `PUT
…/required-actions`, `PUT …/roles`, `PUT …/groups`, `DELETE …/sessions` and
`DELETE …/sessions/{sid}`. It is the reverse of the ceiling `PUT
/subjects/:id/roles` enforces on what a caller grants, and it applies to roles
and groups as well as that one: a ceiling only on doors that take an account
over would leave the demotion that comes first open, since `PUT …/roles` with an
empty list checks nothing it grants, and a `tenant-admin` emptied of its roles
has nothing left for any later check to compare. The rule is checked first,
under the subject's row lock, by one function (`targetOverreach`), which
resolves the target's capabilities through `effectiveRoles` — groups, their
ancestors and composites included — and compares them with the caller's own. A
caller missing any of them is refused with `403` naming what it lacks, and the
attempt writes a `refused` row under the action it attempted, with
`detail.denied`. A caller holding everything the target holds — a `tenant-admin`
acting on another — is admitted, and so is anybody with the route's own
capability acting on a subject holding none. An integration test reads the
routes it sweeps from the route table, so a new mutating route under
`/subjects/{id}` without the check fails it. A client's service account is held
to the same ceiling by every route that mutates the client ([the service
account's ceiling](./post-clientsidsecret.md#the-service-accounts-ceiling)).

## Captured

After the two sections on either side of this one, against the same
`hana`, locked out again first — the same five wrong passwords, and the
right one refused:

```bash
for attempt in 1 2 3 4 5; do signin 'not the password'; done
signin 'correct horse battery staple'

curl -sS -D - -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/recovery-demo/subjects/01a0e303-9db3-712d-9272-98d2c2a04320/password
echo
```

```
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 201 Created
x-request-id: 01a0e304-e89b-7b63-977c-5ee041f0256a
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 47
Date: Sun, 27 Sep 2026 13:19:04 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"password":"pW6gZTlq-xIQGIYgB9BfvU6NbNyxcrfp"}
```

The password is a throwaway on a development stack, and the rest of this
section spends it. It signs in as far as the change-password page with no
wait, although the account was locked a moment ago; the change returns the
sign-in page, as it does for `seed admin`'s password in "Getting the
token"; the new password gets a code; and neither the issued password nor
the one `hana` had before still signs anybody in. `signin` leaves the
`auth_session_id` it used in `$sid`.

```bash
signin 'pW6gZTlq-xIQGIYgB9BfvU6NbNyxcrfp'
curl -sS -o body.html -w '%{http_code}\n' \
  --data-urlencode "auth_session_id=$sid" \
  --data-urlencode "password=tulip-orbit-harbour-58" \
  'http://localhost:3000/tenants/recovery-demo/login-actions/required-action?action=update-password'
grep -o '<title>[^<]*</title>' body.html
signin 'tulip-orbit-harbour-58'
signin 'pW6gZTlq-xIQGIYgB9BfvU6NbNyxcrfp'
signin 'correct horse battery staple'
```

```
HTTP/1.1 200 OK
<title>Change your password</title>
200
<title>Sign in</title>
HTTP/1.1 302 Found
location: https://app.example/callback?code=kEyYyT7ukiYIwCShkZAUNGJkimfiFQX_7ZArlDzthtQ&state=xyz&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Frecovery-demo
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 200 OK
<title>Sign in</title>
```

The ceiling, from `mo` — seeded in `recovery-demo` and given
`manage-users` there through `PUT /subjects/:id/roles`, so `$MO_TOKEN`
carries `manage-users` and the `view-users` it composites — against `lin`,
given `tenant-admin` the same way. The password, disabling the account and
deleting it, each refused, and `lin` left as it was:

```bash
curl -sS -X POST -H "Authorization: Bearer $MO_TOKEN" \
  http://localhost:3000/admin/tenants/recovery-demo/subjects/01a0e303-cd42-76f3-92bd-9f1f860bc8a0/password
echo

curl -sS -X PATCH -H "Authorization: Bearer $MO_TOKEN" -H 'content-type: application/json' \
  -d '{"enabled":false}' \
  http://localhost:3000/admin/tenants/recovery-demo/subjects/01a0e303-cd42-76f3-92bd-9f1f860bc8a0
echo

curl -sS -X DELETE -H "Authorization: Bearer $MO_TOKEN" \
  http://localhost:3000/admin/tenants/recovery-demo/subjects/01a0e303-cd42-76f3-92bd-9f1f860bc8a0
echo
```

```
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the subject holds what the caller does not: manage-clients, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0e305-352c-7c19-98f0-ac995ff67ab6"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the subject holds what the caller does not: manage-clients, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0e305-3545-7f28-9e64-6ebcebd9bda8"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the subject holds what the caller does not: manage-clients, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0e305-355e-7948-94aa-bd9f7b23958d"}
```

The demotion that would come first, refused the same way, then `lin`'s roles,
unchanged, and the two `refused` rows it and a lockout clear wrote. In a tenant
also named `recovery-demo` created there for it, with its own `mo`
(`manage-users`) and `lin` (`tenant-admin`) set up the same way:

The same again, now that each row answers `actor_name` and `actor_origin`; the
ids are a fresh run's, not those above:

```bash
LIN=http://localhost:3082/admin/tenants/recovery-demo/subjects/01a0ee90-8113-7860-8d43-2175e6975b6d
ETAG=$(curl -sS -D - -o /dev/null -H "Authorization: Bearer $MO_TOKEN" "$LIN/roles" | tr -d '\r' | sed -n 's/^etag: //p')
curl -sS -X PUT -H "Authorization: Bearer $MO_TOKEN" -H 'content-type: application/json' \
  -H "If-Match: $ETAG" -d '{"role_ids":[]}' "$LIN/roles"
echo
curl -sS -X DELETE -H "Authorization: Bearer $MO_TOKEN" "$LIN/lockout"
echo
curl -sS -H "Authorization: Bearer $MO_TOKEN" "$LIN/roles"
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/recovery-demo/audit?event_type=admin_mutation&outcome=refused&limit=2'
echo
```

```
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the subject holds what the caller does not: manage-clients, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee90-b399-7446-a234-746e913625a6"}
{"type":"about:blank","title":"Forbidden","status":403,"detail":"the subject holds what the caller does not: manage-clients, manage-tenant, manage-keys, manage-sessions, view-audit","instance":"01a0ee90-b5dc-7596-8f44-6dcdf3d976e4"}
{"items":[{"id":"01a0ee90-580e-7688-b635-280e0a9e75bb","name":"tenant-admin","client_id":"01a0ee90-57cb-7a51-9164-4d2888295163","client_key":"odudu-admin"}]}
{"items":[{"id":"01a0ee90-b5ec-7d42-9fea-4c6a2ca2d7b8","occurred_at":"2026-09-29T19:07:36.298Z","event_type":"admin_mutation","action":"subject.lockout_clear","outcome":"refused","actor_tenant_id":"01a0ee90-5627-7af7-8dce-d98eb1aa9c7a","actor_subject_id":"01a0ee90-6fbc-71d1-9286-e933bcf69384","actor_client_id":"01a0ee90-57cb-7a51-9164-4d2888295163","actor_name":"mo","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee90-8113-7860-8d43-2175e6975b6d","request_id":"01a0ee90-b5dc-7596-8f44-6dcdf3d976e4","ip":"172.22.0.1","detail":{"denied":["manage-clients","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a0ee90-b530-7f48-a043-1cc199dfefda","occurred_at":"2026-09-29T19:07:36.051Z","event_type":"admin_mutation","action":"subject.roles_set","outcome":"refused","actor_tenant_id":"01a0ee90-5627-7af7-8dce-d98eb1aa9c7a","actor_subject_id":"01a0ee90-6fbc-71d1-9286-e933bcf69384","actor_client_id":"01a0ee90-57cb-7a51-9164-4d2888295163","actor_name":"mo","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee90-8113-7860-8d43-2175e6975b6d","request_id":"01a0ee90-b399-7446-a234-746e913625a6","ip":"172.22.0.1","detail":{"denied":["manage-clients","manage-tenant","manage-keys","manage-sessions","view-audit"]}}],"next":"eyJhZnRlciI6IjIwMjYtMDktMjlUMTk6MDc6MzYuMDUxWnwwMWEwZWU5MC1iNTMwLTdmNDgtYTA0My0xY2MxOTlkZmVmZGEiLCJjb2xsZWN0aW9uIjoiYXVkaXQiLCJ0ZW5hbnRJZCI6IjAxYTBlZTkwLTU2MjctN2FmNy04ZGNlLWQ5OGViMWFhOWM3YSIsImZpbHRlcnMiOiJVZDFzeWdzd19Oblp0UzJDZ2dXQk91dVc3UE5YT29TVFlRakVMdDlBN1JZIn0.e-kpCAejGJ48wy3fmFUnWnFy6XVSh8Ou4S_8Dz24j6E"}
```

`ada-recovery` is a subject of the system tenant, not of `recovery-demo`,
so addressing it here is addressing another tenant's subject:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/recovery-demo/subjects/01a0e2e6-9e0a-721e-8def-3f749480e8c9/password
echo
```

```
{"type":"about:blank","title":"Not Found","status":404,"detail":"no user subject 01a0e2e6-9e0a-721e-8def-3f749480e8c9","instance":"01a0e305-3574-7a1e-a164-aa64d106082b"}
```

The rows these sections wrote, newest first — the three refusals with
`detail.denied`, then the issue with an empty `detail`, the end of every
session, the lockout clear, and `lin`'s role assignment from the setup — and the
service's own log searched for the issued password. Bounded with `to=` at a
point between this run and the ceiling demonstration further above, since an
unscoped `limit=7` now surfaces that later demonstration's own rows instead of
these:

With `actor_name` and `actor_origin` on each row, after the same recovery in the
tenant of the same name above, before its ceiling demonstration, and bounded the
same way; the ids and the issued password are a fresh run's, not those above:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3082/admin/tenants/recovery-demo/audit?event_type=admin_mutation&to=2026-09-29T19:07:32.000Z&limit=7'
echo

docker compose logs odudu | grep -c 'xZdG91476aUnqv7I9Ow7w6ZysjNDO2d-'
```

```
{"items":[{"id":"01a0ee90-a22a-7937-bf93-6b780e3e09f6","occurred_at":"2026-09-29T19:07:31.118Z","event_type":"admin_mutation","action":"subject.delete","outcome":"refused","actor_tenant_id":"01a0ee90-5627-7af7-8dce-d98eb1aa9c7a","actor_subject_id":"01a0ee90-6fbc-71d1-9286-e933bcf69384","actor_client_id":"01a0ee90-57cb-7a51-9164-4d2888295163","actor_name":"mo","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee90-8113-7860-8d43-2175e6975b6d","request_id":"01a0ee90-a102-7f9d-a668-d511d7c1c776","ip":"172.22.0.1","detail":{"denied":["manage-clients","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a0ee90-a0b0-7d64-9222-215fce17a0c3","occurred_at":"2026-09-29T19:07:30.851Z","event_type":"admin_mutation","action":"subject.amend","outcome":"refused","actor_tenant_id":"01a0ee90-5627-7af7-8dce-d98eb1aa9c7a","actor_subject_id":"01a0ee90-6fbc-71d1-9286-e933bcf69384","actor_client_id":"01a0ee90-57cb-7a51-9164-4d2888295163","actor_name":"mo","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee90-8113-7860-8d43-2175e6975b6d","request_id":"01a0ee90-a007-7588-ae28-e4c84e936197","ip":"172.22.0.1","detail":{"denied":["manage-clients","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a0ee90-9fea-7807-abbe-61cfe794ca56","occurred_at":"2026-09-29T19:07:30.649Z","event_type":"admin_mutation","action":"subject.password_issue","outcome":"refused","actor_tenant_id":"01a0ee90-5627-7af7-8dce-d98eb1aa9c7a","actor_subject_id":"01a0ee90-6fbc-71d1-9286-e933bcf69384","actor_client_id":"01a0ee90-57cb-7a51-9164-4d2888295163","actor_name":"mo","actor_origin":"tenant","resource_type":"subject","resource_id":"01a0ee90-8113-7860-8d43-2175e6975b6d","request_id":"01a0ee90-9ef8-7d2d-87a9-637c23262314","ip":"172.22.0.1","detail":{"denied":["manage-clients","manage-tenant","manage-keys","manage-sessions","view-audit"]}},{"id":"01a0ee90-9af6-7d69-b4cb-ef4ab6c02f0e","occurred_at":"2026-09-29T19:07:29.240Z","event_type":"admin_mutation","action":"subject.password_issue","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee90-63eb-7f15-b728-2778d1eeb1b2","request_id":"01a0ee90-9996-747f-b057-d2736997b322","ip":"172.22.0.1","detail":{}},{"id":"01a0ee90-996d-7b41-8af2-ef7c4dcb79c8","occurred_at":"2026-09-29T19:07:28.919Z","event_type":"admin_mutation","action":"session.end_all","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee90-63eb-7f15-b728-2778d1eeb1b2","request_id":"01a0ee90-98b2-73e2-8dcc-603f420cdea1","ip":"172.22.0.1","detail":{"ended":2}},{"id":"01a0ee90-9882-771e-b457-690b797a5d7e","occurred_at":"2026-09-29T19:07:28.767Z","event_type":"admin_mutation","action":"subject.lockout_clear","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee90-63eb-7f15-b728-2778d1eeb1b2","request_id":"01a0ee90-9801-7539-b002-2152699cc740","ip":"172.22.0.1","detail":{"cleared":true}},{"id":"01a0ee90-834e-74cd-b6c1-836195dea170","occurred_at":"2026-09-29T19:07:23.325Z","event_type":"admin_mutation","action":"subject.roles_set","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee90-8113-7860-8d43-2175e6975b6d","request_id":"01a0ee90-82fa-7893-90bc-e2d7754452d3","ip":"172.22.0.1","detail":{}}],"next":"eyJhZnRlciI6IjIwMjYtMDktMjlUMTk6MDc6MjMuMzI1WnwwMWEwZWU5MC04MzRlLTc0Y2QtYjZjMS04MzYxOTVkZWExNzAiLCJjb2xsZWN0aW9uIjoiYXVkaXQiLCJ0ZW5hbnRJZCI6IjAxYTBlZTkwLTU2MjctN2FmNy04ZGNlLWQ5OGViMWFhOWM3YSIsImZpbHRlcnMiOiJ6MEhPVzdmamNrYy1ISnhGTHZHOUlmaENwb1FRYUF2b3pBeURyck5nODhNIn0.zjFNAkHr5Uuj4lvGunjfSDELiAKAA-7YkKkhFTkGLDQ"}
0
```
