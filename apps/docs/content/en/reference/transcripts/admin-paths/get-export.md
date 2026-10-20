---
title: 'GET /export'
description: 'GET /admin/tenants/{tenant}/export requires manage-tenant and manage-clients — the second because the document carries every client, which every…'
---

# `GET /export`

`GET /admin/tenants/{tenant}/export` requires `manage-tenant` and
`manage-clients` — the second because the document carries every client,
which every other route reads with `manage-clients` — and answers
the tenant's configuration as one document of media type
`application/vnd.odudu.tenant+json`, carrying `"version": 1`: its settings,
its authentication flow, its clients, its roles and their composites, its
groups and their roles, its scopes with their role mappings, claim mapper
bindings and client assignments, its registration policy, and its SMTP
host, port, sender, username and STARTTLS. Every reference inside it is by
name — a role as its name and the `client_id` it belongs to, `null` for a
tenant role; a group by its path; a scope by its name; a client by its
`client_id` — and no row id, tenant id or timestamp appears anywhere, so
the document means the same thing in whichever tenant it is imported into.
`registration_allowed`, `verify_email` and `client_registration_policy`
travel under `registration_policy`; every other tenant setting is under
`settings`.

No secret is in it: no client secret, SMTP password, password hash, TOTP seed,
passkey, recovery code or private signing key, and no session, consent, grant,
registration token or audit row. Each secret a reader would expect is named
under `omitted` by its JSON path instead — `clients[<i>].secret` for each
confidential client, `smtp.password` when one is set and
`subjects[<i>].credentials` for each exported subject that has any — so the gap
is visible in the file rather than silent. A client's `jwks` is exported with
any private member (`d`, `p`, `q`, `dp`, `dq`, `qi`, `k`) removed from each key,
and each key that lost one is named under `omitted` as
`clients[<i>].jwks.keys[<j>]`. Registration and `POST`/`PATCH /clients` refuse
such a key ([the request
paths](../request-paths/bootstrap.md#dynamic-client-registration) shows the
refusal), so only a row stored before that check can hold one; none in this
tenant does, so no stripped key appears below.

What a new tenant provisions for itself is marked rather than left out:
each role on the built-in `odudu-admin` client and each default scope
(`openid` and the rest) carries `"builtin": true`, so an import can merge
onto its own copies. The `odudu-admin` client itself is not among
`clients`, and no scope lists an assignment to it: an import provisions
its own. A role on it is still referenced as
`{"name": …, "client": "odudu-admin"}`, because a tenant role may carry the
same name as a capability, and a reference that dropped the client would
not tell the two apart.

`?include=subjects` adds `subjects` — each user with a sign-in, its profile
claims and verification flags, its direct roles, its groups by path and its
required actions — and additionally requires `view-users` (which `manage-users`
also reaches), refused with `403` otherwise. Above 10,000 such subjects it is
refused with `413` and `"type": "about:blank#export-too-large"`, naming P7,
whose inbound provisioning is the tool for moving users in bulk; nothing here
holds that many, so that refusal is not shown — an integration test covers it.
Any other `include` is refused with `400`. Every export writes a `tenant.export`
row into the tenant's trail whose `detail` says whether subjects were included.

As a new admin subject `ada-export2` in the system tenant, reusing the
`export-demo` tenant an earlier run created: its confidential client
`billing-app`, tenant role `billing-reader`, group `finance`, subject `grace`
who belongs to it, and SMTP relay whose password is
`relay-password-shown-nowhere`, are all still there. `tenant-operator`, also
still there, was issued a fresh one-time password through `POST
/subjects/:id/password` and signed back in through the tenant's own
`odudu-admin` client, whose token is `$OPERATOR_TOKEN` below. `RUN_START=$(date
-u +%FT%T.000Z)` is set first, so every trail read below is scoped to
`from=$RUN_START` rather than walking the whole (and, on a reused tenant,
already long) history of exports and refusals against `export-demo`.

The export, without subjects:

```bash
RUN_START=$(date -u +%FT%T.000Z)
curl -sS -D - \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3082/admin/tenants/export-demo/export
```

In a tenant also named `export-demo` set up the same way through the endpoints
below — the confidential client `billing-app`, the role `billing-reader`, the
group `finance` mapping it with `grace` in it, and the same SMTP relay — so its
ids and timestamps are that run's, not those of the blocks around it:

```
HTTP/1.1 200 OK
x-request-id: 01a109b5-23bc-7377-9e8f-45413735b988
cache-control: no-store
content-type: application/vnd.odudu.tenant+json; charset=utf-8
content-length: 6598
Date: Mon, 05 Oct 2026 01:37:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"version":1,"settings":{"display_name":null,"enabled":true,"reset_password_allowed":false,"sso_session_idle_seconds":1800,"sso_session_max_seconds":36000,"password_min_length":8,"password_require_digit":false,"password_require_uppercase":false,"password_require_lowercase":false,"password_require_special":false,"password_not_username":true,"password_not_email":true,"password_history_depth":0,"password_max_age_days":0,"otp_required":false,"brute_force_max_failures":5,"brute_force_lockout_seconds":60,"brute_force_max_lockout_seconds":900,"brute_force_failure_reset_seconds":43200,"max_clients":200,"max_sessions_per_browser":25,"remember_me_allowed":false,"remember_me_idle_seconds":604800,"remember_me_max_seconds":2592000,"audit_retention_days":90,"username_editable":false,"access_token_ttl_seconds":300,"id_token_ttl_seconds":300,"refresh_token_ttl_seconds":1209600,"authorization_code_ttl_seconds":60,"login_ttl_seconds":1800,"verify_email_ttl_seconds":43200,"reset_password_ttl_seconds":300,"login_with_email":false,"audit_event_types":["admin_mutation","admin_access","authentication","session","token","credential"]},"flow":[{"authenticator":"passkey","requirement":"alternative"},{"authenticator":"password","requirement":"alternative"},{"authenticator":"otp","requirement":"conditional"},{"authenticator":"recovery-code","requirement":"conditional"}],"clients":[{"client_id":"billing-app","name":"Billing","description":null,"type":"confidential","enabled":true,"full_scope_allowed":false,"registration_origin":"operator","redirect_uris":["https://billing.example/callback"],"grant_types":["authorization_code"],"token_endpoint_auth_method":"client_secret_basic","audiences":[],"access_token_ttl_seconds":null,"id_token_ttl_seconds":null,"refresh_token_ttl_seconds":null,"client_credentials_scopes":[],"web_origins":[],"post_logout_redirect_uris":[],"jwks":null,"jwks_uri":null,"frontchannel_logout_uri":null,"backchannel_logout_uri":null,"frontchannel_logout_session_required":false,"backchannel_logout_session_required":false,"consent_required":false,"token_exchange_impersonation_allowed":false,"userinfo_signed_response_alg":null,"userinfo_encrypted_response_alg":null,"userinfo_encrypted_response_enc":null,"tls_client_auth_subject_dn":null,"client_uri":null,"policy_uri":null,"tos_uri":null,"id_token_signed_response_alg":null,"default_max_age":null,"require_auth_time":false,"service_account_roles":[]}],"roles":[{"name":"billing-reader","client":null,"description":null,"default_for_new_subjects":false,"builtin":false,"composites":[]},{"name":"manage-clients","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[]},{"name":"manage-keys","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[]},{"name":"manage-sessions","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[]},{"name":"manage-tenant","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[]},{"name":"manage-users","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[{"name":"view-users","client":"odudu-admin"}]},{"name":"tenant-admin","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[{"name":"manage-clients","client":"odudu-admin"},{"name":"manage-keys","client":"odudu-admin"},{"name":"manage-sessions","client":"odudu-admin"},{"name":"manage-tenant","client":"odudu-admin"},{"name":"manage-users","client":"odudu-admin"},{"name":"view-audit","client":"odudu-admin"},{"name":"view-users","client":"odudu-admin"}]},{"name":"view-audit","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[]},{"name":"view-users","client":"odudu-admin","description":null,"default_for_new_subjects":false,"builtin":true,"composites":[]}],"groups":[{"path":"/finance","description":null,"default_for_new_subjects":false,"roles":[{"name":"billing-reader","client":null}]}],"scopes":[{"name":"address","description":null,"include_in_id_token":true,"include_in_access_token":false,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]},{"name":"email","description":null,"include_in_id_token":true,"include_in_access_token":false,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]},{"name":"groups","description":null,"include_in_id_token":false,"include_in_access_token":true,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]},{"name":"offline_access","description":null,"include_in_id_token":false,"include_in_access_token":false,"default_client_assignment":"optional","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"optional"}]},{"name":"openid","description":null,"include_in_id_token":true,"include_in_access_token":false,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]},{"name":"phone","description":null,"include_in_id_token":true,"include_in_access_token":false,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]},{"name":"profile","description":null,"include_in_id_token":true,"include_in_access_token":false,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]},{"name":"roles","description":null,"include_in_id_token":false,"include_in_access_token":true,"default_client_assignment":"default","consent_text":null,"display_order":0,"builtin":true,"roles":[],"mappers":[],"clients":[{"client_id":"billing-app","assignment":"default"}]}],"registration_policy":{"registration_allowed":false,"verify_email":false,"client_registration_policy":"disabled"},"smtp":{"host":"smtp.gmail.com","port":587,"from_address":"noreply@example.com","username":"mailer","starttls":true},"omitted":["clients[0].secret","smtp.password"]}
```

The SMTP password appears nowhere in it, nor in the export with subjects:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/export-demo/export | grep -c relay-password-shown-nowhere
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/export-demo/export?include=subjects" | grep -c relay-password-shown-nowhere
```

```
0
0
```

By the same rule the ceiling-removal block below shows, `tenant-operator`
holding `manage-tenant` alone is refused `manage-clients` for either form
of the export — `?include=subjects` and the export without it both answer
`403`:

```bash
curl -sS -H "Authorization: Bearer $OPERATOR_TOKEN" \
  http://localhost:3000/admin/tenants/export-demo/whoami
curl -sS -H "Authorization: Bearer $OPERATOR_TOKEN" \
  "http://localhost:3000/admin/tenants/export-demo/export?include=subjects"
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  http://localhost:3000/admin/tenants/export-demo/export
```

```
{"subjectId":"01a0e4c3-4083-7293-8831-26a05de70216","issuerTenantId":"01a0e4c2-de55-724f-8fb7-a92b9af1da21","capabilities":["manage-tenant"],"crossTenant":false}
{"type":"about:blank","title":"Forbidden","status":403,"instance":"01a0e5d9-ee19-720b-a216-800817e3c760"}
403 application/problem+json; charset=utf-8
```

An `include` other than `subjects` is refused by the generated schema, naming
the parameter, in a tenant also named `export-demo`, created there for it:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/export-demo/export?include=sessions"
```

```
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/include must be equal to constant","errors":[{"path":"include","message":"must be equal to constant"}],"instance":"01a0ea4f-9898-797d-8d56-525b96b6f6ca"}
```

The trail, scoped to this run — the exports (`$ADMIN_TOKEN`'s, allowed)
and then the two refusals (`tenant-operator`'s, naming `manage-clients`
both times):

The same again, now that each row answers `actor_name` and `actor_origin`; the
ids are a fresh run's, not those above:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/export-demo/audit?action=tenant.export&from=$RUN_START"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3082/admin/tenants/export-demo/audit?action=capability.refused&from=$RUN_START"; echo
```

```
{"items":[{"id":"01a0ee8d-ef61-7b06-9e71-2e3ae736de6d","occurred_at":"2026-09-29T19:04:34.385Z","event_type":"admin_mutation","action":"tenant.export","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"tenant","resource_id":"01a0ee8d-dff4-720e-bdb4-15576ad2ebff","request_id":"01a0ee8d-ef48-7511-85ab-1f473209b38b","ip":"172.22.0.1","detail":{"include_subjects":true}},{"id":"01a0ee8d-ef44-7673-b602-460dcbf39665","occurred_at":"2026-09-29T19:04:34.364Z","event_type":"admin_mutation","action":"tenant.export","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"tenant","resource_id":"01a0ee8d-dff4-720e-bdb4-15576ad2ebff","request_id":"01a0ee8d-ef34-7c17-9279-d86c8afed9c7","ip":"172.22.0.1","detail":{"include_subjects":false}},{"id":"01a0ee8d-ef2f-7aa6-a892-59e9c27d618e","occurred_at":"2026-09-29T19:04:34.339Z","event_type":"admin_mutation","action":"tenant.export","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"tenant","resource_id":"01a0ee8d-dff4-720e-bdb4-15576ad2ebff","request_id":"01a0ee8d-ef14-77be-acb8-f45139b61f0a","ip":"172.22.0.1","detail":{"include_subjects":false}}]}
{"items":[{"id":"01a0ee8d-ef81-7a9a-9f95-bcd6e4e83f9b","occurred_at":"2026-09-29T19:04:34.433Z","event_type":"admin_access","action":"capability.refused","outcome":"refused","actor_tenant_id":"01a0ee8d-dff4-720e-bdb4-15576ad2ebff","actor_subject_id":"01a0ee8d-e7a7-7728-b5d1-5bac0435926e","actor_client_id":"01a0ee8d-e002-7eb7-859e-f2b6810e1c0f","actor_name":"tenant-operator","actor_origin":"tenant","resource_type":null,"resource_id":null,"request_id":"01a0ee8d-ef75-7140-acff-159dd214780b","ip":"172.22.0.1","detail":{"reason":"missing_capability","capability":"manage-clients"}},{"id":"01a0ee8d-ef71-7dc3-8778-ce07da5bd8e6","occurred_at":"2026-09-29T19:04:34.417Z","event_type":"admin_access","action":"capability.refused","outcome":"refused","actor_tenant_id":"01a0ee8d-dff4-720e-bdb4-15576ad2ebff","actor_subject_id":"01a0ee8d-e7a7-7728-b5d1-5bac0435926e","actor_client_id":"01a0ee8d-e002-7eb7-859e-f2b6810e1c0f","actor_name":"tenant-operator","actor_origin":"tenant","resource_type":null,"resource_id":null,"request_id":"01a0ee8d-ef65-7217-bf0f-f0ac27727a7c","ip":"172.22.0.1","detail":{"reason":"missing_capability","capability":"manage-clients"}}]}
```

The subjects and `omitted` of the export with subjects, selected with
`jq` — `grace` still owes `update-password`, and `tenant-operator`'s no
longer does, now that the reset above was completed; her password is named
rather than carried:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/export-demo/export?include=subjects" \
  | jq -c '.subjects[], .omitted'
```

```
{"username":"grace","email":"grace@example.com","enabled":true,"profile":{"name":null,"given_name":null,"family_name":null,"middle_name":null,"nickname":null,"preferred_username":null,"profile":null,"picture":null,"website":null,"gender":null,"birthdate":null,"zoneinfo":null,"locale":null,"phone_number":null,"phone_number_verified":false,"email_verified":false,"address_formatted":null,"address_street":null,"address_locality":null,"address_region":null,"address_postal_code":null,"address_country":null},"roles":[],"groups":["/finance"],"required_actions":["update-password"]}
{"username":"tenant-operator","email":null,"enabled":true,"profile":{"name":null,"given_name":null,"family_name":null,"middle_name":null,"nickname":null,"preferred_username":null,"profile":null,"picture":null,"website":null,"gender":null,"birthdate":null,"zoneinfo":null,"locale":null,"phone_number":null,"phone_number_verified":false,"email_verified":false,"address_formatted":null,"address_street":null,"address_locality":null,"address_region":null,"address_postal_code":null,"address_country":null},"roles":[{"name":"manage-tenant","client":"odudu-admin"}],"groups":[],"required_actions":[]}
["clients[0].secret","smtp.password","subjects[1].credentials"]
```

A caller holding `manage-tenant` without `manage-clients` is refused with `403`,
writing the same `capability.refused` row the router writes for a route's own
capability, naming `manage-clients`. On `ceiling-removal` from [a removal is
judged by what it
removes](./get-groupsidroles-and-put-groupsidroles.md#a-removal-is-judged-by-what-it-removes),
whose `$TENANT_TOKEN` holds `manage-tenant` alone, with the row read back as the
system administrator:

```bash
RUN_START=$(date -u +%FT%T.000Z)
curl -sS -H "Authorization: Bearer $TENANT_TOKEN" \
  http://localhost:3000/admin/tenants/ceiling-removal/export
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/tenants/ceiling-removal/audit?action=capability.refused&from=$RUN_START" \
  | jq -c '.items[] | {action, outcome, actor_subject_id, detail}'
```

```
{"type":"about:blank","title":"Forbidden","status":403,"instance":"01a0e5c9-600a-7aa2-91da-e4cb637c903e"}
{"action":"capability.refused","outcome":"refused","actor_subject_id":"01a0e59a-b35c-7fb5-aa5a-78cdc389b30b","detail":{"reason":"missing_capability","capability":"manage-clients"}}
```

## A tenant too large for one document

The document is built in memory, so a tenant holding more than 20,000 clients,
roles or groups, or more than 200,000 rows of any one link table (composites,
group roles, scope role mappings, scope assignments, group memberships), is
refused rather than read. On a tenant `big-demo`, given 20,001 clients with
`insert into clients` and `insert into client_oidc_config` (no origins are
needed for the count):

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/tenants/big-demo/export"
```

```
HTTP/1.1 413 Payload Too Large
x-request-id: 01a10f81-1193-7887-86e7-d45f15a0fdc7
cache-control: no-store
content-type: application/problem+json; charset=utf-8
content-length: 218

{"type":"about:blank#export-too-large","title":"Content Too Large","status":413,"detail":"the tenant holds more than 20000 clients, too many to export in one document","instance":"01a10f81-1193-7887-86e7-d45f15a0fdc7"}
```
