---
title: "One sign-in's audit trail, read through the admin API"
description: 'The sections above read audit_events with psql, one door at a time.'
---

# One sign-in's audit trail, read through the admin API

The sections above read `audit_events` with `psql`, one door at a time.
This one drives a whole sign-in — a login, the code's redemption, a
refresh, a logout — and reads what it left through
`GET /admin/tenants/{tenant}/audit`, which is how an operator reads it.
`$ADMIN_TOKEN` is an admin access token got the way
[the admin paths](../admin-paths/getting-the-token.md) shows, here for a
second `system` administrator seeded on the same stack. `event_type` picks
the kind of row, and `from` narrows both queries to rows written since the
run began, `request_id` not being a filter. `from` is only as precise as the
second `$SINCE` names, so it scopes to this run only on a stack with no
other traffic in `demo`; the request id on each row is what shows that held
here:

```bash
BASE=http://localhost:3082/tenants/demo/protocol/openid-connect
LOGIN=http://localhost:3082/tenants/demo/login-actions/authenticate
SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

VERIFIER=$(openssl rand -hex 32)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 \
  | openssl base64 | tr '+/' '-_' | tr -d '=')

AUTH_SESSION_ID=$(curl -sS --get \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'scope=openid' \
  --data-urlencode 'state=xyz-trail' \
  --data-urlencode "code_challenge=$CHALLENGE" \
  --data-urlencode 'code_challenge_method=S256' \
  "$BASE/auth" | sed -n '/name="auth_session_id"/{s/.*value="\([^"]*\)".*/\1/p;q;}')

CODE=$(curl -sS -D - -o /dev/null -c cookies-trail.txt \
  -H 'x-request-id: trail-sign-in' \
  --data-urlencode "auth_session_id=$AUTH_SESSION_ID" \
  --data-urlencode 'username=ada' \
  --data-urlencode 'password=correct-horse-battery' \
  "$LOGIN" | sed -n 's/.*[?&]code=\([^&[:space:]]*\).*/\1/p' | tr -d '\r')

REFRESH_TOKEN=$(curl -sS -H 'x-request-id: trail-code' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode "code_verifier=$VERIFIER" "$BASE/token" \
  | sed -n 's/.*"refresh_token":"\([^"]*\)".*/\1/p')

curl -sS -o /dev/null -w '%{http_code}\n' -H 'x-request-id: trail-refresh' \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$REFRESH_TOKEN" \
  --data-urlencode 'client_id=demo-spa' "$BASE/token"

PAGE=$(curl -sS -b cookies-trail.txt "$BASE/logout")
SESSION_ID=$(printf '%s' "$PAGE" | sed -n 's/.*name="session_id" value="\([^"]*\)".*/\1/p')
CSRF=$(printf '%s' "$PAGE" | sed -n 's/.*name="csrf" value="\([^"]*\)".*/\1/p')

curl -sS -b cookies-trail.txt -o /dev/null -w '%{http_code}\n' \
  -H 'x-request-id: trail-logout' \
  --data-urlencode "session_id=$SESSION_ID" \
  --data-urlencode "csrf=$CSRF" "$BASE/logout"

for EVENT_TYPE in token session; do
  curl -sS -G -H "Authorization: Bearer $ADMIN_TOKEN" \
    --data-urlencode "event_type=$EVENT_TYPE" \
    --data-urlencode "from=$SINCE" \
    http://localhost:3082/admin/tenants/demo/audit
  echo
done
```

The refresh's status, the logout's, then the `token` page and the
`session` page, newest first:

```
200
200
{"items":[{"id":"01a0ee96-87dd-7f97-b784-a892d1af681b","occurred_at":"2026-09-29T19:13:57.706Z","event_type":"token","action":"token.refresh","outcome":"allowed","actor_tenant_id":"01a0ee8f-032e-718b-b030-be2b154a9e99","actor_subject_id":"01a0ee96-6112-7cc3-a854-5f4ba72b225c","actor_client_id":"01a0ee96-84ed-7dd5-9923-92767eef6df0","actor_name":"ada","actor_origin":"tenant","resource_type":"grant","resource_id":"01a0ee96-8791-7f44-8bae-5ec847f7a4c2","request_id":"trail-refresh","ip":"172.22.0.1","detail":{"scope":"openid"}},{"id":"01a0ee96-8798-708b-bf8c-d732e7e83210","occurred_at":"2026-09-29T19:13:57.630Z","event_type":"token","action":"token.issue","outcome":"allowed","actor_tenant_id":"01a0ee8f-032e-718b-b030-be2b154a9e99","actor_subject_id":"01a0ee96-6112-7cc3-a854-5f4ba72b225c","actor_client_id":"01a0ee96-84ed-7dd5-9923-92767eef6df0","actor_name":"ada","actor_origin":"tenant","resource_type":"grant","resource_id":"01a0ee96-8791-7f44-8bae-5ec847f7a4c2","request_id":"trail-code","ip":"172.22.0.1","detail":{"scope":"openid","grant_type":"authorization_code"}}]}
{"items":[{"id":"01a0ee96-885c-7fc5-aef6-3fd42f3b388f","occurred_at":"2026-09-29T19:13:57.851Z","event_type":"session","action":"session.ended","outcome":"allowed","actor_tenant_id":"01a0ee8f-032e-718b-b030-be2b154a9e99","actor_subject_id":"01a0ee96-6112-7cc3-a854-5f4ba72b225c","actor_client_id":null,"actor_name":"ada","actor_origin":"tenant","resource_type":"session","resource_id":"01a0ee96-874e-7f1b-a875-ff5846806788","request_id":"trail-logout","ip":"172.22.0.1","detail":{"via":"logout"}},{"id":"01a0ee96-8750-7584-aab5-50435e2d0819","occurred_at":"2026-09-29T19:13:57.577Z","event_type":"session","action":"session.created","outcome":"allowed","actor_tenant_id":"01a0ee8f-032e-718b-b030-be2b154a9e99","actor_subject_id":"01a0ee96-6112-7cc3-a854-5f4ba72b225c","actor_client_id":"01a0ee96-84ed-7dd5-9923-92767eef6df0","actor_name":"ada","actor_origin":"tenant","resource_type":"session","resource_id":"01a0ee96-874e-7f1b-a875-ff5846806788","request_id":"trail-sign-in","ip":"172.22.0.1","detail":{}}]}
```

After `demo-spa` was created in `demo` through `POST /clients` as a public
client and `ada` seeded there with `odudu seed user`, so each row answers
`actor_name` and `actor_origin` as well; the ids are a fresh run's. The ids the
rows name:

```bash
docker compose exec -T postgres psql -U odudu -d odudu -c \
  "select t.id as demo, c.id as demo_spa, u.subject_id as ada
     from tenants t
     join clients c on c.tenant_id = t.id and c.client_id = 'demo-spa'
     join users u on u.tenant_id = t.id and u.username = 'ada'
    where t.name = 'demo';"
```

```
                 demo                 |               demo_spa               |                 ada
--------------------------------------+--------------------------------------+--------------------------------------
 01a0ee8f-032e-718b-b030-be2b154a9e99 | 01a0ee96-84ed-7dd5-9923-92767eef6df0 | 01a0ee96-6112-7cc3-a854-5f4ba72b225c
(1 row)
```

The four requests sent with an `x-request-id` left one row each on these
pages, under that id, and no row on either page carries any other — so
nothing else in `demo` wrote a token or session row after `$SINCE`. The
login also wrote a `login.password` row, as [what a refused login leaves
behind](./path-a-authorization-code-with-pkce.md#what-a-refused-login-leaves-behind) shows for a refusal; it is an
`authentication` row, so neither page above returns it. `token.issue` and
`token.refresh` name one grant, which rotation reuses; `session.created` and
`session.ended` name one session. `actor_tenant_id` is `demo` on all four:
it names the tenant the actor belongs to, which differs from the row's own
only when the caller came from elsewhere — a `system` administrator's admin
rows, or a `token.foreign_issuer` refusal. `session.ended` names no client
whichever way the session ends, since ending it ends it for every client
that shared it. The confirmation page the logout fetched first wrote
nothing, and carried no `x-request-id`.
