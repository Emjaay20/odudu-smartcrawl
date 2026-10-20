---
title: 'GET /clients/:id/evaluate'
description: "Requires manage-clients and view-users, since what it answers is the subject's data; without the second it is refused with 403 and a…"
---

# `GET /clients/:id/evaluate`

Requires `manage-clients` and `view-users`, since what it answers is the
subject's data; without the second it is refused with `403` and a
`capability.refused` row. The claims an authorization-code exchange for the
client and `subject` would put in the ID token, the access token and the
UserInfo response: `scope` resolved against the client's assignments as the
exchange resolves it, the subject's roles narrowed to what that scope reaches,
each artefact gated by its own scope flags — computed by the same functions
the exchange and `/userinfo` call (`mappedClaims` and `idTokenScopeOf`,
`@odudu/protocol-oidc`), never a copy of them. Mapped claims only: none of the
envelope a signer adds (`iss`, `aud`, `exp`, …), and nothing is signed.
`id_token` is `null` without `openid`; `scope` absent means the client's
default scopes. It assumes every scope asked for is consented to: for a
client with `consent_required`, a real code carries only the scopes the
subject has consented to, which may be fewer. `scope` is at most 2048
characters. Each evaluation is audited as `client.evaluate`. An unknown
client or subject answers `404`.

Against the tenth stack, for `grace`, her profile given its name claims
through `PATCH /subjects/:id/profile` beforehand; once naming a scope, once
not, and the row it left:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/clients/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123/evaluate?subject=01a0ee8a-c58a-716c-96a6-edcab4ca1a70&scope=openid%20profile%20email%20roles"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/clients/01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123/evaluate?subject=01a0ee8a-c58a-716c-96a6-edcab4ca1a70"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/audit?action=client.evaluate&limit=1"; echo
```

```
{"scope":"openid profile email roles","id_token":{"sub":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","name":"Grace Hopper","given_name":"Grace","family_name":"Hopper","preferred_username":"grace","updated_at":1790708493,"email":"grace@navy.example","email_verified":false},"access_token":{},"userinfo":{"sub":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","name":"Grace Hopper","given_name":"Grace","family_name":"Hopper","preferred_username":"grace","updated_at":1790708493,"email":"grace@navy.example","email_verified":false}}
{"scope":"openid profile email address phone roles groups","id_token":{"sub":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","name":"Grace Hopper","given_name":"Grace","family_name":"Hopper","preferred_username":"grace","updated_at":1790708493,"email":"grace@navy.example","email_verified":false},"access_token":{"groups":["/finance/payables"]},"userinfo":{"sub":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70","name":"Grace Hopper","given_name":"Grace","family_name":"Hopper","preferred_username":"grace","updated_at":1790708493,"email":"grace@navy.example","email_verified":false,"groups":["/finance/payables"]}}
{"items":[{"id":"01a0ee8b-36e3-7657-8294-ea4e0498f059","occurred_at":"2026-09-29T19:01:36.085Z","event_type":"admin_mutation","action":"client.evaluate","outcome":"allowed","actor_tenant_id":"0199aa00-0000-7000-8000-000000000001","actor_subject_id":"01a0ee8a-bfb8-763c-ac22-0c8d97b0fada","actor_client_id":"01a0ee8a-bf72-77c9-a423-f61084924d9f","actor_name":null,"actor_origin":"system","resource_type":"client","resource_id":"01a0ee8a-d1a7-7c3c-a05b-903a2d8fa123","request_id":"01a0ee8b-36c5-7315-bb6f-d5c0b7732ca2","ip":"172.22.0.1","detail":{"scope":"openid profile email address phone roles groups","subject_id":"01a0ee8a-c58a-716c-96a6-edcab4ca1a70"}}],"next":"eyJhZnRlciI6IjIwMjYtMDktMjlUMTk6MDE6MzYuMDg1WnwwMWEwZWU4Yi0zNmUzLTc2NTctODI5NC1lYTRlMDQ5OGYwNTkiLCJjb2xsZWN0aW9uIjoiYXVkaXQiLCJ0ZW5hbnRJZCI6IjAxYTBlZThhLWMzOTQtN2I0OS05NDJiLTNkZWE3MGE5NjJlNyIsImZpbHRlcnMiOiI1V1p5R0tkUVJIX3VEUTNNRkpGclFtYzFDdWt4UllCcV9XSDhFc1dWd1ZBIn0.L9X-Z6lPk9dhSI-ZVeSTnwzC4owFeLuOMZdoJGBw-RI"}
```

Neither answer carries `roles`, though `grace` holds two and asked for the
scope: `ops-app` is not full-scope, and the `roles` scope maps neither of hers,
so a real token would carry none either. `groups` reaches the access token and
UserInfo but not the ID token, whose `include_in_id_token` it has off.
