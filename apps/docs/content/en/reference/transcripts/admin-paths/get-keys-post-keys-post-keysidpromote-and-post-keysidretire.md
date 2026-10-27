---
title: 'GET /keys, POST /keys, POST /keys/:id/promote and POST…'
description: 'All four require manage-keys, never manage-tenant — a tenant admin who may reconfigure clients need not also be trusted to rotate what signs their…'
---

## `GET /keys`, `POST /keys`, `POST /keys/:id/promote` and `POST /keys/:id/retire`

All four require `manage-keys`, never `manage-tenant` — a tenant admin who
may reconfigure clients need not also be trusted to rotate what signs their
tokens. `GET /keys` lists `id`, `status`, `kid`, `alg`, `created_at` and
`not_after`; it never carries `public_jwk` or `private_jwk_encrypted`, the
signing key's own admin representation being metadata about it rather than
the key itself.

`POST /keys` generates a key of the given `alg` (`RS256` or `ES256`) and
stores it as `rotating`, published in `/certs` (JWKS) immediately —
`signing_keys_one_active` constrains `active` alone, so staging never
collides with it. `POST /keys/:id/promote` demotes the tenant's current
`active` key to `rotating` and promotes this one, in one transaction: no
window has two active keys or none. `POST /keys/:id/retire` answers `409`
in two cases, checked in that order: while the key's own status is
`active` — promote another key first, however well its algorithm is
otherwise covered — and, once that is ruled out, while a client is still
registered with a `userinfo_signed_response_alg` or an
`id_token_signed_response_alg` no remaining non-retired key would produce,
naming the offending client id(s) in the response `detail`.

This ordering exists to dissolve a deadlock: registration itself refuses a
`userinfo_signed_response_alg` no non-retired key produces
(`client-registration.ts`'s own `algorithmsAvailable` check), so a client
cannot move to a new algorithm before something can sign it, and retiring
the old key first would leave nothing able to sign for a client still on
it. Staging a key as `rotating` makes its algorithm producible before it is
default, which is what lets a client migrate ahead of the promotion that
makes the new key the tenant's own.

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/keys
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alg": "ES256"}' \
  http://localhost:3000/admin/tenants/demo/keys
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/keys/01a0d6fe-e527-77e6-b71d-57ed1a903cc3/promote
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/keys
```

The whole rotation against `demo`, which was provisioned with one `ES256`
key when the tenant was created. Listing, staging, promoting, listing
again:

```
{"items":[{"id":"01a0d6fc-3654-7f93-817b-bd7f1bb2ff55","status":"active","kid":"01a0d6fc-3654-7f93-817b-bd7eb6490305","alg":"ES256","created_at":"2026-09-25T05:14:08.294Z","not_after":null}]}
{"id":"01a0d6fe-e527-77e6-b71d-57ed1a903cc3","status":"rotating","kid":"01a0d6fe-e526-7caf-9184-e66cbfab9a4b","alg":"ES256","created_at":"2026-09-25T05:17:04.166Z","not_after":null}
{"id":"01a0d6fe-e527-77e6-b71d-57ed1a903cc3","status":"active","kid":"01a0d6fe-e526-7caf-9184-e66cbfab9a4b","alg":"ES256","created_at":"2026-09-25T05:17:04.166Z","not_after":null}
{"items":[{"id":"01a0d6fc-3654-7f93-817b-bd7f1bb2ff55","status":"rotating","kid":"01a0d6fc-3654-7f93-817b-bd7eb6490305","alg":"ES256","created_at":"2026-09-25T05:14:08.294Z","not_after":null},{"id":"01a0d6fe-e527-77e6-b71d-57ed1a903cc3","status":"active","kid":"01a0d6fe-e526-7caf-9184-e66cbfab9a4b","alg":"ES256","created_at":"2026-09-25T05:17:04.166Z","not_after":null}]}
```

The promotion demoted the old key in the same transaction, so the second
listing has exactly one `active`. Retiring the one it demoted succeeds;
retiring the newly promoted one is refused, as the typed refusals below show:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/admin/tenants/demo/keys/01a0d6fc-3654-7f93-817b-bd7f1bb2ff55/retire
```

```
{"id":"01a0d6fc-3654-7f93-817b-bd7f1bb2ff55","status":"retired","kid":"01a0d6fc-3654-7f93-817b-bd7eb6490305","alg":"ES256","created_at":"2026-09-25T05:14:08.294Z","not_after":null}
```

### The refusals have types

Retire answers `409` in two cases and delete in one, each of a type of its own, so a
caller tells them apart without reading `detail`: `about:blank#key-active` (the key's
own status is `active`), `#key-algorithm-needed` (a client's
`userinfo_signed_response_alg` or `id_token_signed_response_alg` is one no remaining
non-retired key produces) and, for `DELETE`, `#key-not-retired`.

The algorithm refusal names at most 20 clients, in `client_id` order, as
`errors` entries of path `clients` (the id is the `message`), and the number it
left out as one entry of path `clients.more`; `detail` carries the same cut list
ending `and N more`. In `key-refusals`, which starts with one `ES256` key that
is `active`: that key retired, an `RS256` key staged, that key deleted, a client
`billing` registered with `userinfo_signed_response_alg` `RS256` (which the
staged key makes producible), the keys listed to show the staged key is the only
non-retired `RS256` one, and the staged key retired:

```bash
ACTIVE=$(curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys" | python3 -c 'import json,sys;print(json.load(sys.stdin)["items"][0]["id"])')
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys/$ACTIVE/retire"; echo
STAGED=$(curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"alg":"RS256"}' "$P/keys" | tee /dev/stderr | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys/$STAGED"; echo
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"client_id":"billing","redirect_uris":["https://billing.example/callback"],"userinfo_signed_response_alg":"RS256"}' \
  "$P/clients" -o /dev/null -w '%{http_code}\n'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys"; echo
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys/$STAGED/retire"; echo
```

```
{"type":"about:blank#key-active","title":"Conflict","status":409,"detail":"signing key 01a131b5-eea5-775d-9b0e-bab28d5b9921 is active; promote another key first","instance":"01a131b5-ef3d-75f6-93c9-570682878f50"}
{"id":"01a131b5-ef84-763d-859a-edc844a3b3e7","status":"rotating","kid":"01a131b5-ef84-763d-859a-edc7e41d53c0","alg":"RS256","created_at":"2026-10-12T20:02:49.324Z","not_after":null}
{"type":"about:blank#key-not-retired","title":"Conflict","status":409,"detail":"the key is rotating: only a retired key can be deleted; retire it first","instance":"01a131b5-ef98-70b5-a0eb-e927830634d1"}
201
{"items":[{"id":"01a131b5-eea5-775d-9b0e-bab28d5b9921","status":"active","kid":"01a131b5-eea4-7b5e-9076-2036575802e8","alg":"ES256","created_at":"2026-10-12T20:02:48.877Z","not_after":null},{"id":"01a131b5-ef84-763d-859a-edc844a3b3e7","status":"rotating","kid":"01a131b5-ef84-763d-859a-edc7e41d53c0","alg":"RS256","created_at":"2026-10-12T20:02:49.324Z","not_after":null}]}
{"type":"about:blank#key-algorithm-needed","title":"Conflict","status":409,"detail":"no remaining signing key produces RS256, still required by userinfo_signed_response_alg or id_token_signed_response_alg on client(s): billing","errors":[{"path":"clients","message":"billing"}],"instance":"01a131b5-f09d-75f0-bcf0-a0d3ff17d97c"}
```

The second line is the staged key, printed by the `tee`.

With twenty-one more clients on `RS256` (`app-01` to `app-21`, registered the same way,
their answers discarded), the same retire names the first twenty and counts the
rest, `billing` among them:

```bash
for i in $(seq -w 1 21); do curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d "{\"client_id\":\"app-$i\",\"redirect_uris\":[\"https://app-$i.example/callback\"],\"userinfo_signed_response_alg\":\"RS256\"}" "$P/clients" -o /dev/null; done
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$P/keys/$STAGED/retire"; echo
```

```
{"type":"about:blank#key-algorithm-needed","title":"Conflict","status":409,"detail":"no remaining signing key produces RS256, still required by userinfo_signed_response_alg or id_token_signed_response_alg on client(s): app-01, app-02, app-03, app-04, app-05, app-06, app-07, app-08, app-09, app-10, app-11, app-12, app-13, app-14, app-15, app-16, app-17, app-18, app-19, app-20 and 2 more","errors":[{"path":"clients","message":"app-01"},{"path":"clients","message":"app-02"},{"path":"clients","message":"app-03"},{"path":"clients","message":"app-04"},{"path":"clients","message":"app-05"},{"path":"clients","message":"app-06"},{"path":"clients","message":"app-07"},{"path":"clients","message":"app-08"},{"path":"clients","message":"app-09"},{"path":"clients","message":"app-10"},{"path":"clients","message":"app-11"},{"path":"clients","message":"app-12"},{"path":"clients","message":"app-13"},{"path":"clients","message":"app-14"},{"path":"clients","message":"app-15"},{"path":"clients","message":"app-16"},{"path":"clients","message":"app-17"},{"path":"clients","message":"app-18"},{"path":"clients","message":"app-19"},{"path":"clients","message":"app-20"},{"path":"clients.more","message":"2"}],"instance":"01a131b5-f89a-75bf-926a-a54fab601fd2"}
```

Whether a key may be promoted before relying parties have fetched it is not refused:
the console shows when it is ready and leaves the choice to the operator.

**Filters.** `?status=active|rotating|retired` and `?alg=RS256|ES256` are exact,
`AND`ed with each other, and bound into the cursor like every other listing's
filters; any other parameter is refused with `400` naming it. Neither has an
index: a tenant holds a handful of keys. Whose `demo` held one key, `active` and
`ES256`, so the first filter matches nothing and the second finds it:

```bash
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/keys?status=active&alg=RS256"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/keys?alg=ES256"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/keys?status=pending"
curl -sS \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3080/admin/tenants/demo/keys?kid=x"
```

```
{"items":[]}
{"items":[{"id":"01a0ea4c-08b4-77b6-9ba5-89aa2348c2a1","status":"active","kid":"01a0ea4c-08b3-709e-8f42-9ae93cf18faa","alg":"ES256","created_at":"2026-09-28T23:14:06.596Z","not_after":null}]}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/status must be equal to one of the allowed values","errors":[{"path":"status","message":"must be equal to one of the allowed values"}],"instance":"01a0ea5e-5eb6-7059-ba9d-94bd832f36cc"}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring must NOT have additional properties: kid","errors":[{"path":"kid","message":"must NOT have additional properties"}],"instance":"01a0ea5e-5ec1-775d-8b09-75ee325d8104"}
```

### A key's `ETag`

`POST /keys`, promote and retire each answer an `ETag` over the key they answer.
Promote and retire honour it as `If-Match` when it is sent, taken over the key
as it stands under the write's own lock, and refuse a stale one with `412`;
neither requires it. In `etags-demo`:

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"alg":"RS256"}' http://localhost:3080/admin/tenants/etags-demo/keys \
  | grep -E '^(HTTP/|etag:|\{)'
curl -sS -D - -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'If-Match: "0000"' \
  http://localhost:3080/admin/tenants/etags-demo/keys/01a0e9ec-b000-7842-96c3-6475d4f6e651/promote \
  | grep -E '^(HTTP/|etag:|\{)'
curl -sS -D - -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'If-Match: "3ec2140faff0825bec2afd86b419e16bd83744ce67f7fc3020a050e9f9e859a2"' \
  http://localhost:3080/admin/tenants/etags-demo/keys/01a0e9ec-b000-7842-96c3-6475d4f6e651/promote \
  | grep -E '^(HTTP/|etag:|\{)'
```

```
HTTP/1.1 201 Created
etag: "3ec2140faff0825bec2afd86b419e16bd83744ce67f7fc3020a050e9f9e859a2"
{"id":"01a0e9ec-b000-7842-96c3-6475d4f6e651","status":"rotating","kid":"01a0e9ec-afff-7ce4-8c78-95aff244235b","alg":"RS256","created_at":"2026-09-28T21:29:57.991Z","not_after":null}
HTTP/1.1 412 Precondition Failed
{"type":"about:blank","title":"Precondition Failed","status":412,"detail":"If-Match no longer matches","instance":"01a0e9ec-b03e-7c15-b96f-ebcb3e5d528b"}
HTTP/1.1 200 OK
etag: "590baab1ba6f8492799c2636f440bfbe33c9354dff4143bb4021ed47a015305e"
{"id":"01a0e9ec-b000-7842-96c3-6475d4f6e651","status":"active","kid":"01a0e9ec-afff-7ce4-8c78-95aff244235b","alg":"RS256","created_at":"2026-09-28T21:29:57.991Z","not_after":null}
```
