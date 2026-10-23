---
title: 'GET /subjects'
description: 'Requires view-users, and manage-users reaches it too: every manage-* role is composited to its view-* counterpart through role_composites.'
---

# `GET /subjects`

Requires `view-users`. `manage-users` also reaches it: `provisionAdminClient`
composites every `manage-*` role to its `view-*` counterpart through
`role_composites`, so a caller holding only `manage-users` already holds
`view-users` by the time `authorizeAdmin` resolves its effective roles — nothing
in the route special-cases it. Pages by an opaque cursor, `?limit=` and
`?cursor=`, ordered by `id`, the same convention every other listing in this API
follows.

**Search** is a prefix of one named field, case-insensitive: `?username=`,
`?email=`, or one of the name claims `?name=`, `?given_name=` and
`?family_name=` — as stored, never the username a `name` claim falls back
to — one at a time. The prefix is folded by PostgreSQL's
`lower()`, the same function that fills the stored `username_search`,
`email_search` and name-claim search columns (`0073_list_indexes_subjects.sql`,
`0079_list_indexes_subject_claims.sql`), and matched as a
range between two bounds rather than with `LIKE`, so `%`, `_` and `\` are
ordinary characters. A searched listing is ordered by that folded column,
in code-point order, then by `id`, and its cursor carries the folded value
of the last row. A subject with no `users` row (`type: "service"`,
provisioned for a confidential client's service account) never matches a
search and is only ever reached by an unsearched page.

**Exact filters** are `?enabled=true|false`, `?type=user|service|agent_instance`,
`?locked=true|false` (locked out now, by the clock `GET /subjects/:id/lockout`
judges with), `?role=<id>` (subjects the role is assigned to directly, not
through a group or a composite) and `?group=<id>` (the group's direct
members). `GET /subjects/count` takes every one of them. `?capability=<name>` is the
one that is not direct: subjects holding that capability — or
`tenant-admin` — however they hold it, directly, through a group or one of
its ancestors, or through a role that nests it, which is how the console
lists a tenant's administrators. Every parameter given is `AND`ed. A cursor is bound to the filters it was minted under, so replaying
it with any other set is refused, and any parameter not named here is
refused with `400` naming it — `?search=`, which this listing once took,
among them.

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/demo/subjects?limit=50"
```

Three subjects by the time this ran, and the first is the point of the
paragraph above: `demo-backend`'s service account, created with the client
and carrying no `users` row, so `username` and `email` are `null` and no
search would ever return it. `ada` is `POST /subjects` below; `bob` is
the seeded user the sessions section needs:

```
{"items":[{"id":"01a0d6fc-e571-7685-b843-00be9303dd03","type":"service","username":null,"email":null,"enabled":true,"created_at":"2026-09-25T05:14:53.164Z"},{"id":"01a0d6fd-9453-7bf0-9823-a5fc6ea34836","type":"user","username":"ada","email":"ada@demo.example","enabled":true,"created_at":"2026-09-25T05:15:37.939Z"},{"id":"01a0d6fd-ede7-704b-8d83-fa3801d427a0","type":"user","username":"bob","email":"bob@demo.example","enabled":true,"created_at":"2026-09-25T05:16:00.867Z"}]}
```

In the searches below `demo` holds `ada` (`ada@example.com`, created by `POST
/subjects` below) and the service subjects of its confidential clients;
`Adaline` and `adam` were created through `POST /subjects` just before, with no
email. `ADA` finds all three, in folded order:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?username=ADA"
```

```
{"items":[{"id":"01a0ea54-2519-7513-8bf7-c105e0cfd9dd","type":"user","username":"ada","email":"ada@example.com","enabled":true,"created_at":"2026-09-28T23:22:58.200Z"},{"id":"01a0ea54-2556-7831-8443-acf0d9ac9f1d","type":"user","username":"Adaline","email":null,"enabled":true,"created_at":"2026-09-28T23:22:58.262Z"},{"id":"01a0ea54-256c-7e66-a2f7-ab933f2e09c8","type":"user","username":"adam","email":null,"enabled":true,"created_at":"2026-09-28T23:22:58.284Z"}]}
```

One at a time, the `Link` header carries the search forward:

```bash
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?username=ADA&limit=1"
```

```
HTTP/1.1 200 OK
x-request-id: 01a0ea54-2592-7a2c-999b-fef1b77df6be
cache-control: no-store
link: </admin/tenants/demo/subjects?limit=1&username=ADA&cursor=eyJhZnRlciI6IjAxYTBlYTU0LTI1MTktNzUxMy04YmY3LWMxMDVlMGNmZDlkZCIsInNvcnQiOiJhZGEiLCJjb2xsZWN0aW9uIjoic3ViamVjdHMiLCJ0ZW5hbnRJZCI6IjAxYTBlYTRjLTA4ODQtNzRmYS04MjVjLTA1ZjZlZjU2OGRkMCIsImZpbHRlcnMiOiJzWGl1TzdkZGVoRzhlYVUyUWkySWotRnJjVVAyMWVwTUJBWmxEc3FQYUVVIn0.H-WwEeA2mcgEbcO-pWwMqoinmct5oyuEKm8zQFMWF3U>; rel="next"
content-type: application/json; charset=utf-8
content-length: 478
Date: Mon, 28 Sep 2026 23:22:58 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a0ea54-2519-7513-8bf7-c105e0cfd9dd","type":"user","username":"ada","email":"ada@example.com","enabled":true,"created_at":"2026-09-28T23:22:58.200Z"}],"next":"eyJhZnRlciI6IjAxYTBlYTU0LTI1MTktNzUxMy04YmY3LWMxMDVlMGNmZDlkZCIsInNvcnQiOiJhZGEiLCJjb2xsZWN0aW9uIjoic3ViamVjdHMiLCJ0ZW5hbnRJZCI6IjAxYTBlYTRjLTA4ODQtNzRmYS04MjVjLTA1ZjZlZjU2OGRkMCIsImZpbHRlcnMiOiJzWGl1TzdkZGVoRzhlYVUyUWkySWotRnJjVVAyMWVwTUJBWmxEc3FQYUVVIn0.H-WwEeA2mcgEbcO-pWwMqoinmct5oyuEKm8zQFMWF3U"}
```

Following that link, then replaying its cursor under `?username=b`:

```bash
CURSOR='eyJhZnRlciI6IjAxYTBlYTU0LTI1MTktNzUxMy04YmY3LWMxMDVlMGNmZDlkZCIsInNvcnQiOiJhZGEiLCJjb2xsZWN0aW9uIjoic3ViamVjdHMiLCJ0ZW5hbnRJZCI6IjAxYTBlYTRjLTA4ODQtNzRmYS04MjVjLTA1ZjZlZjU2OGRkMCIsImZpbHRlcnMiOiJzWGl1TzdkZGVoRzhlYVUyUWkySWotRnJjVVAyMWVwTUJBWmxEc3FQYUVVIn0.H-WwEeA2mcgEbcO-pWwMqoinmct5oyuEKm8zQFMWF3U'
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?limit=1&username=ADA&cursor=$CURSOR"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?limit=1&username=b&cursor=$CURSOR"
```

```
{"items":[{"id":"01a0ea54-2556-7831-8443-acf0d9ac9f1d","type":"user","username":"Adaline","email":null,"enabled":true,"created_at":"2026-09-28T23:22:58.262Z"}],"next":"eyJhZnRlciI6IjAxYTBlYTU0LTI1NTYtNzgzMS04NDQzLWFjZjBkOWFjOWYxZCIsInNvcnQiOiJhZGFsaW5lIiwiY29sbGVjdGlvbiI6InN1YmplY3RzIiwidGVuYW50SWQiOiIwMWEwZWE0Yy0wODg0LTc0ZmEtODI1Yy0wNWY2ZWY1NjhkZDAiLCJmaWx0ZXJzIjoic1hpdU83ZGRlaEc4ZWFVMlFpMklqLUZyY1VQMjFlcE1CQVpsRHNxUGFFVSJ9.B1M9m1juGcg_CLMgO130ZSYKZswaUbDMFkdGAQYhP4o"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"cursor is invalid or expired","errors":[{"path":"cursor","message":"is invalid or expired"}],"instance":"01a0ea54-25c0-797c-8b91-812c43b272ba"}
```

`?email=ADA%40`, then the retired `?search=ada`, then
`?username=a&email=b`. The first refusal is the generated schema's, hence
its generic `title`; the second is the handler's:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?email=ADA%40"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?search=ada"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/subjects?username=a&email=b"
```

```
{"items":[{"id":"01a0ea54-2519-7513-8bf7-c105e0cfd9dd","type":"user","username":"ada","email":"ada@example.com","enabled":true,"created_at":"2026-09-28T23:22:58.200Z"}]}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring must NOT have additional properties: search","errors":[{"path":"search","message":"must NOT have additional properties"}],"instance":"01a0ea54-25eb-75d3-ad5e-7aaa463f9644"}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"search one field at a time: username or email, not both","errors":[{"path":"email","message":"search one field at a time: username or email, not both"}],"instance":"01a0ea54-25f5-763a-8556-6c0f71c15a6f"}
```

## Filtering by capability

In a tenant `admins-demo` created for it, as `ada-t2` — a system administrator,
so no holder of anything in `admins-demo` itself. `grace`
(`01a0ea0f-36a4-7377-b18e-c6e48982a5cf`) was created there and given
`tenant-admin` alone, which nests `view-users`, so she is listed under both:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3080/admin/tenants/admins-demo/subjects?capability=tenant-admin'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3080/admin/tenants/admins-demo/subjects?capability=view-users'
```

```
{"items":[{"id":"01a0ea0f-36a4-7377-b18e-c6e48982a5cf","type":"user","username":"grace","email":null,"enabled":true,"created_at":"2026-09-28T22:07:40.707Z"}]}
{"items":[{"id":"01a0ea0f-36a4-7377-b18e-c6e48982a5cf","type":"user","username":"grace","email":null,"enabled":true,"created_at":"2026-09-28T22:07:40.707Z"}]}
```

Holding through a group or a composite is shown by an integration test, not
here.

## Holders of any capability, and what each holds

`capability=any` lists every subject holding at least one admin capability,
however it holds it, and `/subjects/count?capability=any` counts them. Under any
`capability` filter each item also carries `admin_capabilities`: every name it
holds effectively, `tenant-admin` among them, each with `direct` — whether it is
assigned to the subject itself rather than only through a group or a role that
nests it. It is read for the whole page in one query (`adminCapabilitiesOf`), so
a list of holders never asks per row; which group or role carries a holding is
`GET /subjects/:id/effective-roles`' answer. A listing with no `capability`
filter carries no such field.

As `ada-t9`, a system administrator seeded with `seed user` and `seed grant-role
--role odudu-admin:tenant-admin`. In a tenant `holders-demo`, all through
`seed`: `grace` assigned `tenant-admin`; `linus` a member of `/auditors`, which
is mapped to `view-audit`; `mei` assigned `view-users` and `manage-sessions`;
and `bob`, who holds nothing. The listing, its count, a page of two with its
`link`, and `bob` found by name, carrying no `admin_capabilities` since that
listing is not filtered by capability:

```bash
P=http://localhost:3082/admin/tenants/holders-demo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?capability=any"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/count?capability=any"; echo
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?capability=any&limit=2"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?username=bob"; echo
```

```
{"items":[{"id":"01a10a7d-5942-7332-a5b6-2397a9e53571","type":"user","username":"grace","email":null,"enabled":true,"created_at":"2026-10-05T05:15:49.436Z","admin_capabilities":[{"name":"tenant-admin","direct":true},{"name":"view-users","direct":false},{"name":"manage-users","direct":false},{"name":"manage-clients","direct":false},{"name":"manage-tenant","direct":false},{"name":"manage-keys","direct":false},{"name":"manage-sessions","direct":false},{"name":"view-audit","direct":false}]},{"id":"01a10a7d-5af3-7c7b-9a9d-a9563044e85d","type":"user","username":"linus","email":null,"enabled":true,"created_at":"2026-10-05T05:15:49.870Z","admin_capabilities":[{"name":"view-audit","direct":false}]},{"id":"01a10a7d-5cfe-7324-b44c-9877c28a2d78","type":"user","username":"mei","email":null,"enabled":true,"created_at":"2026-10-05T05:15:50.394Z","admin_capabilities":[{"name":"view-users","direct":true},{"name":"manage-sessions","direct":true}]}]}
{"count":3,"capped":false}
HTTP/1.1 200 OK
x-request-id: 01a10a7d-8300-7580-ba1b-eda334c45132
cache-control: no-store
link: </admin/tenants/holders-demo/subjects?limit=2&capability=any&cursor=eyJhZnRlciI6IjAxYTEwYTdkLTVhZjMtN2M3Yi05YTlkLWE5NTYzMDQ0ZTg1ZCIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMTBhN2QtMzg4Ni03NTVhLWExZGEtOGFkMGFhMmQ1YWQ2IiwiZmlsdGVycyI6InJXRnNaN2Y3d3JBRDFrck0wQXJORFY1dEgwXzJNZEdSQW5kV2NmUTBBelUifQ.whYgO_QpD-V6fE1qy0WiRaYQLulYCMcMjrMM-oyB2D4>; rel="next"
content-type: application/json; charset=utf-8
content-length: 992
Date: Mon, 05 Oct 2026 05:16:00 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"items":[{"id":"01a10a7d-5942-7332-a5b6-2397a9e53571","type":"user","username":"grace","email":null,"enabled":true,"created_at":"2026-10-05T05:15:49.436Z","admin_capabilities":[{"name":"tenant-admin","direct":true},{"name":"view-users","direct":false},{"name":"manage-users","direct":false},{"name":"manage-clients","direct":false},{"name":"manage-tenant","direct":false},{"name":"manage-keys","direct":false},{"name":"manage-sessions","direct":false},{"name":"view-audit","direct":false}]},{"id":"01a10a7d-5af3-7c7b-9a9d-a9563044e85d","type":"user","username":"linus","email":null,"enabled":true,"created_at":"2026-10-05T05:15:49.870Z","admin_capabilities":[{"name":"view-audit","direct":false}]}],"next":"eyJhZnRlciI6IjAxYTEwYTdkLTVhZjMtN2M3Yi05YTlkLWE5NTYzMDQ0ZTg1ZCIsImNvbGxlY3Rpb24iOiJzdWJqZWN0cyIsInRlbmFudElkIjoiMDFhMTBhN2QtMzg4Ni03NTVhLWExZGEtOGFkMGFhMmQ1YWQ2IiwiZmlsdGVycyI6InJXRnNaN2Y3d3JBRDFrck0wQXJORFY1dEgwXzJNZEdSQW5kV2NmUTBBelUifQ.whYgO_QpD-V6fE1qy0WiRaYQLulYCMcMjrMM-oyB2D4"}
{"items":[{"id":"01a10a7d-5ebc-7d00-9f74-e53b9038a916","type":"user","username":"bob","email":null,"enabled":true,"created_at":"2026-10-05T05:15:50.840Z"}]}
```

`grace`'s capabilities other than `tenant-admin` are held within it, so none
is direct; `linus` holds `view-audit` only through `/auditors`; `bob` is in
neither list nor count.

## Filtering by type, lockout and name

After `grace`'s profile was given `name`, `given_name` and `family_name` through
`PATCH /subjects/:id/profile` and five wrong passwords were submitted for
`linus` inside a minute: two name searches, the refusal of two at once,
`linus`'s lockout as the per-subject read answers it, the locked subjects and
their count, and the one subject of type `service`, `ops-app`'s service account,
beside the count of users:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?name=grace%20h"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?family_name=HOP"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?name=grace&username=grace"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/01a0ee8a-c748-743d-b60e-9b0ed48221a3/lockout"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?locked=true"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/count?locked=true"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?type=service"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/count?type=user"; echo
```

```
{"items":[{"id":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","type":"user","username":"grace","email":"grace@navy.example","enabled":true,"created_at":"2026-09-29T19:01:07.075Z"}]}
{"items":[{"id":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","type":"user","username":"grace","email":"grace@navy.example","enabled":true,"created_at":"2026-09-29T19:01:07.075Z"}]}
{"type":"about:blank","title":"Bad Request","status":400,"detail":"search one field at a time: username or name, not both","errors":[{"path":"name","message":"search one field at a time: username or name, not both"}],"instance":"01a0ee8b-2d91-7207-9ff0-5667db14c7c8"}
{"locked":true,"locked_until":"2026-09-29T19:02:33.177Z","failure_count":5,"last_failure_at":"2026-09-29T19:01:33.177Z"}
{"items":[{"id":"01a0ee8a-c748-743d-b60e-9b0ed48221a3","type":"user","username":"linus","email":null,"enabled":true,"created_at":"2026-09-29T19:01:07.522Z"}]}
{"count":1,"capped":false}
{"items":[{"id":"01a0ee8a-d189-7b39-b7b4-e37a483b6268","type":"service","username":null,"email":null,"enabled":true,"created_at":"2026-09-29T19:01:10.146Z"}]}
{"count":5,"capped":false}
```
