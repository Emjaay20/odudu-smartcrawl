---
title: 'PATCH /subjects/:id'
description: 'Requires manage-users. Amends email and enabled — and username, where the tenant allows it (below) — the only general fields a subject exposes…'
---

## `PATCH /subjects/:id`

Requires `manage-users`. Amends `email` and `enabled` — and `username`,
where the tenant allows it (below) — the only general fields a subject
exposes; everything else about a subject (credentials, required actions,
roles) has its own door below. An `email` another subject in the tenant
already holds is refused with `409`, as on `POST /subjects`. Honours
`If-Match`, answering `412` on a mismatch, the same convention every other
amendment in this API follows — locked with `SELECT … FOR NO KEY UPDATE`
before the `ETag` is computed, so two concurrent amendments cannot both
pass the precondition. `NO KEY UPDATE` rather than `UPDATE`, as on every
admin route that mutates a subject: it still queues a second admin
mutation, but not a sign-in inserting a row that names the subject, which
takes a key-share lock and would otherwise deadlock against it. Held to the target ceiling
([`POST /subjects/:id/password`](./post-subjectsidpassword.md#the-target-ceiling)), as every route that
mutates a subject is: refused with `403` when the subject holds an admin
capability the caller does not.

```bash
curl -sS -D - -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}' \
  http://localhost:3000/admin/tenants/demo/subjects/01a0d6fd-9453-7bf0-9823-a5fc6ea34836
```

```
HTTP/1.1 200 OK
etag: "e0aa2da695d68cf78750779f56f4003957282bd6a88ddab5b3aa117e2efa7a19"
content-type: application/json; charset=utf-8

{"id":"01a0d6fd-9453-7bf0-9823-a5fc6ea34836","type":"user","username":"ada","email":"ada@demo.example","enabled":false,"created_at":"2026-09-25T05:15:37.939Z"}
```

_(Not re-run for the `cache-control: no-store` pass: same reason as the
read above.)_

The `ETag` is the one `GET /subjects/:id` above returned, recomputed — a
caller that read before this write holds a stale one.

### Renaming a username

A username is not an identifier a relying party may key on — `sub` is
([ADR 0039](https://github.com/wizzywit/odudu/blob/main/docs/adr/0039-names-relying-parties-match-on-are-identifiers.md)) —
so it is renamable, through this same `PATCH`, behind the tenant setting
`username_editable`, `false` by default. With it off, `username` in the body
is refused with `400` naming the setting. With it on, the new name is held to
the rule creation holds one to (a non-empty string, `usernameSchema` in
`@odudu/contracts`), and `If-Match` is **mandatory** whenever `username` is
in the body — `428` without it, the precedent `redirect_uris` sets on
`PATCH /clients/{id}` — because one administrator's rename silently undoing
another's is what the precondition exists to stop. A name another subject
in the tenant holds refuses the whole request with `409`: the unique index
`users_username_unique` answers, outside the transaction, so nothing else
the same body asked for is applied either. That index is on
`(tenant_id, username)` and case-sensitive, so a case-variant of another
subject's name (`Ada` beside `ada`) is a distinct name and is accepted — as
it is on `POST /subjects` and at sign-in, which match a username exactly. A
rename to the name the subject already has, with nothing else in the body,
writes nothing and no audit row. An actual rename writes one
`subject.amend` row whose `detail` carries the before and after values.

Nothing keyed on the subject moves: sessions and refresh tokens hold `sub`,
so both keep working; the brute-force counter is keyed by subject rather
than by the name submitted, so a `login_failures` row survives the rename;
and `preferred_username` (and `name`, when no display name is set) carries
the new name on the next token issued. The old name stops signing in at
once. A password equal to the new username is not re-checked against
`password_not_username` until it is next changed, which is when every
password policy applies.

Captured against `infra/docker` after a rebuild of the `odudu` service that
applied `0077_username_editable.sql`, as a new system admin `ada-rename`
(`seed admin`), in a tenant `rename-demo` created for it through
`POST /admin/tenants`, on a subject `grace` seeded with a real password
(`odudu seed user`), a second subject `ada` created through
`POST /subjects`, and a confidential client `rename-demo-app` created
through `POST /clients` with `https://app.example/callback` registered and
the `authorization_code` and `refresh_token` grants; `$CLIENT_SECRET` is the
secret that create returned. `$GRACE` is `01a0e37c-9f28-77e3-8579-d0907e90b1c3`, and `signin` is the
helper [`DELETE /subjects/:id/lockout`](./delete-subjectsidlockout.md#delete-subjectsidlockout) defines,
pointed at this client with `profile` in the scope and taking the username
as its argument:

```bash
AUTHORIZE='http://localhost:3000/tenants/rename-demo/protocol/openid-connect/auth?response_type=code&client_id=rename-demo-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid%20profile&state=xyz&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
signin() {
  sid=$(curl -sS "$AUTHORIZE" | sed -n 's/.*name="auth_session_id" value="\([^"]*\)".*/\1/p' | head -1)
  curl -sS -D - -o body.html \
    --data-urlencode "auth_session_id=$sid" \
    --data-urlencode "username=$1" \
    --data-urlencode "password=correct horse battery staple" \
    http://localhost:3000/tenants/rename-demo/login-actions/authenticate | grep -iE '^(HTTP|location)'
  grep -o '<title>[^<]*</title>' body.html || true
}
```

With the setting still at its default, the rename is refused. This one
refusal was captured against the sixth stack, in a tenant also named
`rename-demo` created there for it, on its own `grace`
(`01a0ea54-d24b-7445-9226-9123b58e9e4e`), since the first stack's `rename-demo` is gone; the rest
of this section is that first capture:

```bash
curl -sS -D - -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: *' \
  -d '{"username": "grace-hopper"}' \
  http://localhost:3080/admin/tenants/rename-demo/subjects/$GRACE
```

```
HTTP/1.1 400 Bad Request
x-request-id: 01a0ea54-d25b-70fa-baab-fa89b03dea50
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 301
Date: Mon, 28 Sep 2026 23:23:42 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Bad Request","status":400,"detail":"username: this tenant has not enabled username editing (username_editable)","errors":[{"path":"username","message":"this tenant has not enabled username editing (username_editable)"}],"instance":"01a0ea54-d25b-70fa-baab-fa89b03dea50"}
```

Turning it on — `PATCH /settings` reaches it too — then signing `grace`
in and redeeming the code, keeping the refresh token:

```bash
docker compose exec -T odudu node dist/main.js seed tenant --name rename-demo --set username_editable=true 2>/dev/null

loc=$(signin grace | tee /dev/stderr | tr -d '\r' | sed -n 's/^location: //p')
code=$(echo "$loc" | sed -n 's/.*code=\([^&]*\).*/\1/p')
REFRESH_TOKEN=$(curl -sS -u "rename-demo-app:$CLIENT_SECRET" \
  --data-urlencode grant_type=authorization_code --data-urlencode "code=$code" \
  --data-urlencode redirect_uri=https://app.example/callback \
  --data-urlencode code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk \
  http://localhost:3000/tenants/rename-demo/protocol/openid-connect/token | sed -n 's/.*"refresh_token":"\([^"]*\)".*/\1/p')
echo "refresh token length ${#REFRESH_TOKEN}"
```

```
{"command":"tenant","created":false,"tenant":"rename-demo","tenantId":"01a0e37c-9ce6-79d3-a088-ba646b0b9917","settings":["username_editable"]}
HTTP/1.1 302 Found
location: https://app.example/callback?code=u7NfghfY65Cv_CMaF2GmK_AibKzovcN84Y0Lz1Nvb7k&state=xyz&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Frename-demo
refresh token length 43
```

Without `If-Match`, the rename is refused and nothing changes:

```bash
curl -sS -D - -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "grace-hopper"}' \
  http://localhost:3000/admin/tenants/rename-demo/subjects/$GRACE
```

```
HTTP/1.1 428 Precondition Required
x-request-id: 01a0e37d-0d3d-71b8-b54b-58bf801044f4
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 181
Date: Sun, 27 Sep 2026 15:30:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Precondition Required","status":428,"detail":"If-Match is required to replace a subject's username","instance":"01a0e37d-0d3d-71b8-b54b-58bf801044f4"}
```

Reading the subject for its `ETag`, then renaming under it:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/rename-demo/subjects/$GRACE

curl -sS -D - -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "07c46668d99ac4e0d32d58908d78d5d04ea89d0eaf03470bdd5662d830f63c08"' \
  -d '{"username": "grace-hopper"}' \
  http://localhost:3000/admin/tenants/rename-demo/subjects/$GRACE
```

```
HTTP/1.1 200 OK
x-request-id: 01a0e37d-0d59-7a31-813e-162ee1bb2c3d
cache-control: no-store
etag: "07c46668d99ac4e0d32d58908d78d5d04ea89d0eaf03470bdd5662d830f63c08"
content-type: application/json; charset=utf-8
content-length: 146
Date: Sun, 27 Sep 2026 15:30:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0e37c-9f28-77e3-8579-d0907e90b1c3","type":"user","username":"grace","email":null,"enabled":true,"created_at":"2026-09-27T15:29:50.369Z"}

HTTP/1.1 200 OK
x-request-id: 01a0e37d-0d71-7b2c-8918-ddf9dca2a612
cache-control: no-store
etag: "dc0ac68013546a9ca613220ddfc34b73e5d99e8b681c651bcecb0a6d22c07d81"
content-type: application/json; charset=utf-8
content-length: 153
Date: Sun, 27 Sep 2026 15:30:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0e37c-9f28-77e3-8579-d0907e90b1c3","type":"user","username":"grace-hopper","email":null,"enabled":true,"created_at":"2026-09-27T15:29:50.369Z"}
```

The refresh token `grace` held before the rename still redeems, and the
access token it buys reads the new name back from `/userinfo`:

```bash
ACCESS_TOKEN=$(curl -sS -u "rename-demo-app:$CLIENT_SECRET" \
  --data-urlencode grant_type=refresh_token \
  --data-urlencode "refresh_token=$REFRESH_TOKEN" \
  http://localhost:3000/tenants/rename-demo/protocol/openid-connect/token | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
echo "access token length ${#ACCESS_TOKEN}"
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:3000/tenants/rename-demo/protocol/openid-connect/userinfo
```

```
access token length 691
{"sub":"01a0e37c-9f28-77e3-8579-d0907e90b1c3","name":"grace-hopper","preferred_username":"grace-hopper"}
```

The old name no longer signs in with the right password; the new one does:

```bash
signin grace
signin grace-hopper
```

```
HTTP/1.1 200 OK
<title>Sign in</title>
HTTP/1.1 302 Found
location: https://app.example/callback?code=tVn0xzcPENRQ4yAfzhtOoiiJ85cWXohi4NgdgtE2eAQ&state=xyz&iss=http%3A%2F%2Flocalhost%3A3000%2Ftenants%2Frename-demo
```

Renaming to `ada`, which the other subject holds, with an email change in
the same body — refused, and a read afterwards shows neither applied and
the `ETag` unchanged:

```bash
curl -sS -D - -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "dc0ac68013546a9ca613220ddfc34b73e5d99e8b681c651bcecb0a6d22c07d81"' \
  -d '{"username": "ada", "email": "grace@rename.example"}' \
  http://localhost:3000/admin/tenants/rename-demo/subjects/$GRACE

curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/rename-demo/subjects/$GRACE
```

```
HTTP/1.1 409 Conflict
x-request-id: 01a0e37d-0e85-76d4-a49e-833f42b3e389
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 154
Date: Sun, 27 Sep 2026 15:30:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"type":"about:blank","title":"Conflict","status":409,"detail":"the username \"ada\" is already in use","instance":"01a0e37d-0e85-76d4-a49e-833f42b3e389"}

HTTP/1.1 200 OK
x-request-id: 01a0e37d-0eb3-7a56-bfc2-68761f0d90ba
cache-control: no-store
etag: "dc0ac68013546a9ca613220ddfc34b73e5d99e8b681c651bcecb0a6d22c07d81"
content-type: application/json; charset=utf-8
content-length: 153
Date: Sun, 27 Sep 2026 15:30:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0e37c-9f28-77e3-8579-d0907e90b1c3","type":"user","username":"grace-hopper","email":null,"enabled":true,"created_at":"2026-09-27T15:29:50.369Z"}
```

`Ada`, a case-variant of that same name, is a different name to
`users_username_unique`, and is accepted under the same `ETag`:

```bash
curl -sS -D - -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "dc0ac68013546a9ca613220ddfc34b73e5d99e8b681c651bcecb0a6d22c07d81"' \
  -d '{"username": "Ada"}' \
  http://localhost:3000/admin/tenants/rename-demo/subjects/$GRACE
```

```
HTTP/1.1 200 OK
x-request-id: 01a0e37d-0ecc-7554-bf0c-c15ec0474da2
cache-control: no-store
etag: "59790dd68519f35537ae76289a644b4caf1ebbcd47c933830b8f719b7b1c4501"
content-type: application/json; charset=utf-8
content-length: 144
Date: Sun, 27 Sep 2026 15:30:18 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"id":"01a0e37c-9f28-77e3-8579-d0907e90b1c3","type":"user","username":"Ada","email":null,"enabled":true,"created_at":"2026-09-27T15:29:50.369Z"}
```

The audit trail for `grace` holds the two renames and nothing for the
refused ones — the `409` rolled back with its transaction, and the `400`
and `428` were refused before anything was written:

Recaptured against the tenth stack, once each row answered `actor_name` and
`actor_origin`, after the same renames and refusals were made there against
a `grace` seeded in a tenant of the same name, `username_editable` on, so the
ids are that run's, not those above:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/rename-demo/audit?resource_type=subject&resource_id=$GRACE"; echo
```

```
{"items":[{"id":"01a0ee8f-5fb5-792d-b8a6-34c2673e2c04","occurred_at":"2026-09-29T19:06:08.688Z","event_type":"admin_mutation","action":"subject.amend","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee8f-5d26-7a80-b7c9-3c64c4f582cf","request_id":"01a0ee8f-5fa4-7964-85ce-e82236b46ff3","ip":"172.22.0.1","detail":{"username":{"after":"Ada","before":"grace-hopper"}}},{"id":"01a0ee8f-5f83-702a-858a-e775655db38b","occurred_at":"2026-09-29T19:06:08.639Z","event_type":"admin_mutation","action":"subject.amend","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"subject","resource_id":"01a0ee8f-5d26-7a80-b7c9-3c64c4f582cf","request_id":"01a0ee8f-5f73-7961-bb79-d4978fb330e7","ip":"172.22.0.1","detail":{"username":{"after":"grace-hopper","before":"grace"}}}]}
```
