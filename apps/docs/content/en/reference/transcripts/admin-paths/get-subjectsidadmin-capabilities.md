---
title: 'GET /subjects/:id/admin-capabilities'
description: 'Requires view-users. The admin capabilities the subject holds, each as the effective role it is, with every path it is held by (direct, group…'
---

# `GET /subjects/:id/admin-capabilities`

Requires `view-users`. The admin capabilities the subject holds, each as the
effective role it is, with every path it is held by (`direct`, `group`,
`composite`, as `GET /subjects/:id/effective-roles` says them), and the held
roles that carry them: a role nesting a capability, directly or through a
group, which losing would take the capability with it. They are found among
the roles that reach a capability, not among the whole effective set, so a
subject holding more roles than one page of effective roles still answers
everything it needs to be judged by. The answer is whole and carries no `next`:
at most 200 carriers, and `complete` is `false` when more exist, in which case
nothing may be judged from it. It is what a console decides a subject's reach
by, and what a write would take from the caller itself. An unknown subject
answers `404`.

In `perf-demo` (`grace` assigned `manage-users` and a role `key-keepers` that
nests `manage-keys`, and a member of `/auditors`, which maps `view-audit`);
`manage-users` nests `view-users`:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$G/admin-capabilities"
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects/$UNKNOWN/admin-capabilities"
```

```
HTTP/1.1 200 OK
x-request-id: 01a1102f-0919-70e4-ba9b-b280f2c060ed
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 1087

{"items":[{"id":"01a1102b-7631-79fc-8d95-1a242a4e3b9e","name":"view-users","client_id":"01a1102b-7622-73ee-9a6c-924823336f39","client_key":"odudu-admin","via":[{"kind":"composite","parent_role_id":"01a1102b-7633-7fbb-bf93-ec2c2883508a","parent_name":"manage-users"}]},{"id":"01a1102b-7633-7fbb-bf93-ec2c2883508a","name":"manage-users","client_id":"01a1102b-7622-73ee-9a6c-924823336f39","client_key":"odudu-admin","via":[{"kind":"direct"}]},{"id":"01a1102b-7637-7d26-8626-75f48968f4ac","name":"manage-keys","client_id":"01a1102b-7622-73ee-9a6c-924823336f39","client_key":"odudu-admin","via":[{"kind":"composite","parent_role_id":"01a1102f-0798-7f7e-bf4f-8f0c840b2120","parent_name":"key-keepers"}]},{"id":"01a1102b-7639-76ca-93f4-7775c0712172","name":"view-audit","client_id":"01a1102b-7622-73ee-9a6c-924823336f39","client_key":"odudu-admin","via":[{"kind":"group","group_id":"01a1102b-96ac-7ac9-83bb-3a14a3b2c70e","group_path":"/auditors"}]},{"id":"01a1102f-0798-7f7e-bf4f-8f0c840b2120","name":"key-keepers","client_id":null,"client_key":null,"via":[{"kind":"direct"}]}],"complete":true}
```

```
HTTP/1.1 404 Not Found
x-request-id: 01a1102f-094d-7c4e-8560-816c60ac32e3
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 164

{"type":"about:blank","title":"Not Found","status":404,"detail":"no subject 01a1102b-0000-7000-8000-000000000000","instance":"01a1102f-094d-7c4e-8560-816c60ac32e3"}
```
