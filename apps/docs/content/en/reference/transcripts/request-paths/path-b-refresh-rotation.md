---
title: 'Path B: refresh rotation'
description: 'Refresh tokens rotate: every successful refresh consumes the presented token and returns a new one.'
---

# Path B: refresh rotation

Refresh tokens rotate: every successful refresh consumes the presented
token and returns a new one. Presenting a consumed token is treated as
evidence of theft, and revokes the entire family.

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$R1" \
  --data-urlencode 'client_id=demo-spa' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "refresh_token": "f6MHISD3w9RHfGDjlSerx…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid profile email"
}
```

No `id_token`: nobody authenticated during a refresh, and reissuing one
would assert a fresh authentication that did not happen. Refresh tokens live
14 days; the access token they mint lives 300 seconds, like any other.

Scope may narrow, never widen. Sending `scope=openid` against a grant of
`openid profile email` returns `"scope": "openid"`; sending a scope not in
the grant is `invalid_scope`, run below.

## Replaying a refresh token

Presenting `R1` again, after it has already been rotated into `R2`:

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$R1" \
  --data-urlencode 'client_id=demo-spa' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{ "error": "invalid_grant", "error_description": "The code or token is not valid." }
```

and now `R2` — the legitimate, current, never-used token — is dead as well:

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$R2" \
  --data-urlencode 'client_id=demo-spa' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{ "error": "invalid_grant", "error_description": "The code or token is not valid." }
```

That is the point. One of the two holders of `R1` is a thief and the server
cannot tell which, so the grant is revoked and both are forced back through
authentication. The client's response to `invalid_grant` on a refresh is to
discard its tokens and restart Path A.

## What a replay does not do

Because reuse detection is this destructive, it must not be reachable by
anybody but the token's holder. A different client presenting somebody
else's refresh token is refused **without** consuming it:

```bash
curl -sS -u demo-backend:demo-backend-secret \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$RT" \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{ "error": "invalid_grant", "error_description": "The code or token is not valid." }
```

So is a request from the rightful client asking for more scope than it was
granted:

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$RT" \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'scope=openid profile email admin' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{
  "error": "invalid_scope",
  "error_description": "A requested scope is not available to this client."
}
```

and the owner's token still works afterwards — neither attempt burned it:

```bash
curl -sS --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$RT" \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'scope=openid' \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{
  "access_token": "eyJhbGciOiJS…",
  "refresh_token": "ciZhY-VRY-RK…",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid"
}
```

If the grant were evaluated only after rotation, either of those two
refusals would have marked the presented token used, the owner's next
legitimate refresh would have looked like reuse, and the family would have
been revoked — reuse detection turned into a weapon against the client it
exists to protect. The grant is therefore evaluated on both sides of the
rotation: before, as a gate that can only refuse, and again afterwards
against the grant the rotating transaction itself read.

## Replaying an authorization code

The same reasoning applies one hop earlier. A code can be redeemed once; a
second redemption revokes the grant the first one produced (RFC 6749
§4.1.2):

```bash
curl -sS --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'client_id=demo-spa' --data-urlencode "code_verifier=$VERIFIER" \
  'http://localhost:3000/tenants/demo/protocol/openid-connect/token'
```

```json
{ "error": "invalid_grant", "error_description": "The code or token is not valid." }
```

and the refresh token issued from the first, successful redemption is now
refused too:

```json
{ "error": "invalid_grant", "error_description": "The code or token is not valid." }
```

A redemption that fails for any other reason — wrong verifier, wrong
`redirect_uri`, wrong client — leaves the code usable, because the whole
attempt is rolled back. Verified: after all three failures above, the
correct redemption of the same code still returned 200.

## What a refused token request leaves in the audit log

A refusal at `/token`, `/revoke` or `/introspect` rolls its own transaction
back, so its row is written afterwards, in a transaction of its own, and a
failure to write it is logged rather than returned: the response is the one the
caller would have had with no audit at all. Which refusals write a row is
decided by what the request names ([ADR
0037](https://github.com/wizzywit/odudu/blob/main/docs/adr/0037-refusal-rows-are-bounded-by-the-principal-they-name.md)).
Every command below carries its own `x-request-id` and every query is scoped to
those ids. All of it ran against the same stack as [what a refused login leaves
behind](./path-a-authorization-code-with-pkce.md#what-a-refused-login-leaves-behind),
with `demo-backend` seeded as in [Bootstrap](./bootstrap.md).

A wrong secret for a registered client, and a `client_id` nobody
registered:

```bash
curl -sS -w '\n%{http_code}\n' -H 'x-request-id: token-refused-wrong-secret' \
  -u demo-backend:wrong-secret --data-urlencode 'grant_type=client_credentials' \
  "$BASE/token"
curl -sS -w '\n%{http_code}\n' -H 'x-request-id: token-refused-unknown-client' \
  -u nobody-here:anything --data-urlencode 'grant_type=client_credentials' \
  "$BASE/token"

docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
  "select e.event_type, e.action, e.outcome, c.client_id as actor_client, e.request_id, e.detail
     from audit_events e left join clients c on c.id = e.actor_client_id
    where e.request_id in ('token-refused-wrong-secret', 'token-refused-unknown-client');"
docker compose logs odudu | grep 'unregistered client_id' | sed 's/^[^|]*| //'
```

```
{"error":"invalid_client","error_description":"Client authentication failed."}
401
{"error":"invalid_client","error_description":"Client authentication failed."}
401
-[ RECORD 1 ]+--------------------------------------------------------------
event_type   | authentication
action       | client.authenticate
outcome      | refused
actor_client | demo-backend
request_id   | token-refused-wrong-secret
detail       | {"method": "client_secret_basic", "reason": "bad_credential"}

{"level":40,"time":1790394525341,"pid":1,"hostname":"d7d0702d851a","reqId":"token-refused-unknown-client","tenantId":"01a0db22-1c32-7d17-b351-697d7911033c","claimedClientId":"nobody-here","msg":"client authentication refused for an unregistered client_id"}
```

- **The two answers are the same bytes; one wrote a row and one did not.**
  A registered client is a principal the row can name. A `client_id` nobody
  registered names nobody, so it is a `warn` line from the first attempt:
  otherwise every guessed name would be a row. `method` is the method the
  request attempted, never the one the client registered. How many rows a
  registered client can cause is bounded below.

Reusing a refresh token, and replaying the code it came from. `$R1` here is
a refresh token already rotated once, and `$CODE` with `$VERIFIER` the code
that issued it, both from a fresh Path A run:

```bash
curl -sS -w '\n' -H 'x-request-id: token-refused-reuse-then-replay' \
  --data-urlencode 'grant_type=refresh_token' --data-urlencode "refresh_token=$R1" \
  --data-urlencode 'client_id=demo-spa' "$BASE/token"
curl -sS -w '\n' -H 'x-request-id: token-refused-replay-after-reuse' \
  --data-urlencode 'grant_type=authorization_code' --data-urlencode "code=$CODE" \
  --data-urlencode 'redirect_uri=http://localhost:8080/callback' \
  --data-urlencode 'client_id=demo-spa' --data-urlencode "code_verifier=$VERIFIER" \
  "$BASE/token"

docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
  "select e.action, e.outcome, e.actor_subject_id, c.client_id as actor_client,
          e.resource_type, e.resource_id, e.request_id, e.detail
     from audit_events e left join clients c on c.id = e.actor_client_id
    where e.request_id in ('token-refused-reuse-then-replay',
                           'token-refused-replay-after-reuse')
    order by e.request_id desc, e.outcome;"
```

```
{"error":"invalid_grant","error_description":"The code or token is not valid."}
{"error":"invalid_grant","error_description":"The code or token is not valid."}
-[ RECORD 1 ]----+-------------------------------------
action           | grant.revoked_on_reuse
outcome          | allowed
actor_subject_id | 01a0db22-1c92-7730-9d37-4085f28eca2c
actor_client     | demo-spa
resource_type    | grant
resource_id      | 01a0de55-903e-7638-9eaf-d67227d6783b
request_id       | token-refused-reuse-then-replay
detail           | {"reason": "replayed"}
-[ RECORD 2 ]----+-------------------------------------
action           | token.refresh
outcome          | refused
actor_subject_id | 01a0db22-1c92-7730-9d37-4085f28eca2c
actor_client     | demo-spa
resource_type    | grant
resource_id      | 01a0de55-903e-7638-9eaf-d67227d6783b
request_id       | token-refused-reuse-then-replay
detail           | {"reason": "replayed"}
-[ RECORD 3 ]----+-------------------------------------
action           | token.issue
outcome          | refused
actor_subject_id | 01a0db22-1c92-7730-9d37-4085f28eca2c
actor_client     | demo-spa
resource_type    | grant
resource_id      | 01a0de55-903e-7638-9eaf-d67227d6783b
request_id       | token-refused-replay-after-reuse
detail           | {"reason": "replayed"}
```

(Run after a revocation row came to be written only by the request that revoked;
the request ids are new because an earlier run left rows under the old ones.)

- **The request that revokes writes what the server did and what it
  refused.** The `grant.revoked_on_*` row is written in the transaction
  that revokes, and a failure to write it cannot undo the revocation; the
  refusal row names the same grant. The code replay finds that grant
  already revoked by the reuse, so it writes its refusal and no revocation
  row: only a call that changed the grant records a revocation, so a spent
  code replayed any number of times revokes, and records, once. The
  revocation row names the grant's own client, the refusal the client that
  asked, which differ when another client presents the code.
- **A refusal after the client authenticated is a row, while its client's
  budget lasts**: `invalid_grant`, `invalid_scope`, `invalid_target` and
  `unauthorized_client`, under `token.issue`, `token.refresh` or
  `token.exchange` by grant type, and a token exchange's `invalid_request`,
  shown below. An `invalid_request` for a request missing a parameter is
  refused before the client is known, and writes nothing.
- **A refresh can leave an `allowed` and a `refused` `token.refresh` under
  one request id.** When the rotation commits and the check after it then
  refuses (a revocation or a disabled subject landing between the two), the
  `allowed` row is true, the presented token was consumed and a
  replacement exists, and the refusal says why none was returned.

A token exchange answers `invalid_request` both for a subject token it
refuses and for a request missing one (RFC 8693 §2.2.2), and only the first
is a decision about the client, so only the first is a row. `demo` has no
client registered for the grant, so this run seeds one and lets it
impersonate, which `seed client` has no flag for (as in
[Path D](./path-d-token-exchange.md)):

```bash
odudu seed client --tenant demo \
  --client-id demo-exchanger --client-secret demo-exchanger-secret \
  --redirect-uri http://localhost:8080/callback \
  --grant-type authorization_code \
  --grant-type urn:ietf:params:oauth:grant-type:token-exchange
docker compose exec -T postgres psql -U odudu -d odudu -c "
    UPDATE client_oidc_config
    SET token_exchange_impersonation_allowed = true
    FROM clients
    WHERE clients.id = client_oidc_config.client_id AND clients.client_id = 'demo-exchanger'
      AND client_oidc_config.tenant_id = (SELECT id FROM tenants WHERE name = 'demo');"

curl -sS -w '\n' -H 'x-request-id: exchange-refused-subject-token' \
  -u demo-exchanger:demo-exchanger-secret \
  --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:token-exchange' \
  --data-urlencode 'subject_token=not-a-token-this-server-issued' \
  --data-urlencode 'subject_token_type=urn:ietf:params:oauth:token-type:access_token' \
  "$BASE/token"
curl -sS -w '\n' -H 'x-request-id: exchange-refused-malformed' \
  -u demo-exchanger:demo-exchanger-secret \
  --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:token-exchange' \
  --data-urlencode 'subject_token_type=urn:ietf:params:oauth:token-type:access_token' \
  "$BASE/token"

docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
  "select e.action, e.outcome, c.client_id as actor_client, e.request_id, e.detail
     from audit_events e left join clients c on c.id = e.actor_client_id
    where e.request_id in ('exchange-refused-subject-token', 'exchange-refused-malformed');"
```

The seed's JSON line is omitted; the rest is the run's output:

```
UPDATE 1
{"error":"invalid_request","error_description":"The request is missing a parameter or has a wrong one."}
{"error":"invalid_request","error_description":"The request is missing a parameter or has a wrong one."}
-[ RECORD 1 ]+-------------------------------
action       | token.exchange
outcome      | refused
actor_client | demo-exchanger
request_id   | exchange-refused-subject-token
detail       | {"reason": "invalid_grant"}
```

The two answers are the same bytes and one wrote a row. A subject token
that is unknown, expired, revoked or another client's is `invalid_grant`,
an actor `may_act` does not name is `subject_mismatch`, and a token type
the server does not exchange is `unsupported_token_type`, each under
`token.exchange` and the client's budget; the request with no
`subject_token` was refused while it was parsed, before any client was
known (ADR 0037's second amendment).

`/revoke` records a revocation it performs, and a refusal to revoke another
client's grant. `$RT` is a refresh token `demo-spa` holds, fresh from
another Path A run:

```bash
curl -sS -w '\n%{http_code}\n' -H 'x-request-id: revoke-foreign-grant' \
  -u demo-backend:demo-backend-secret --data-urlencode "token=$RT" "$BASE/revoke"
curl -sS -w '%{http_code}\n' -H 'x-request-id: revoke-own-grant' \
  --data-urlencode 'client_id=demo-spa' --data-urlencode "token=$RT" "$BASE/revoke"

docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
  "select e.action, e.outcome, e.actor_subject_id, c.client_id as actor_client,
          e.resource_type, e.resource_id, e.request_id, e.detail
     from audit_events e left join clients c on c.id = e.actor_client_id
    where e.request_id in ('revoke-foreign-grant', 'revoke-own-grant')
    order by e.occurred_at;"
```

```
{"error":"invalid_grant","error_description":"The code or token is not valid."}
400
200
-[ RECORD 1 ]----+-------------------------------------
action           | token.revoke
outcome          | refused
actor_subject_id | 01a0db22-1c92-7730-9d37-4085f28eca2c
actor_client     | demo-backend
resource_type    | grant
resource_id      | 01a0dbd6-0207-7337-8006-201eac7bb5ef
request_id       | revoke-foreign-grant
detail           | {"reason": "invalid_grant"}
-[ RECORD 2 ]----+-------------------------------------
action           | token.revoke
outcome          | allowed
actor_subject_id | 01a0db22-1c92-7730-9d37-4085f28eca2c
actor_client     | demo-spa
resource_type    | grant
resource_id      | 01a0dbd6-0207-7337-8006-201eac7bb5ef
request_id       | revoke-own-grant
detail           | {}
```

A token this server never issued still answers `200`, and writes nothing,
because nothing was revoked:

```bash
curl -sS -w '%{http_code}\n' -H 'x-request-id: revoke-unknown-token' \
  --data-urlencode 'client_id=demo-spa' \
  --data-urlencode 'token=not-a-token-this-server-issued' "$BASE/revoke"
docker compose exec -T postgres psql -U odudu -d odudu -c \
  "select count(*) from audit_events where request_id = 'revoke-unknown-token';"
```

```
200
 count
-------
     0
(1 row)
```

`/introspect` records a failed client authentication the same way, and
nothing else: a successful introspection issues and changes nothing.

```bash
curl -sS -w '\n%{http_code}\n' -H 'x-request-id: introspect-refused-wrong-secret' \
  -u demo-backend:wrong-secret --data-urlencode 'token=anything' "$BASE/token/introspect"
curl -sS -w '\n%{http_code}\n' -H 'x-request-id: introspect-refused-unknown-client' \
  -u nobody-here:anything --data-urlencode 'token=anything' "$BASE/token/introspect"

docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
  "select e.event_type, e.action, e.outcome, c.client_id as actor_client, e.request_id, e.detail
     from audit_events e left join clients c on c.id = e.actor_client_id
    where e.request_id in ('introspect-refused-wrong-secret', 'introspect-refused-unknown-client');"
```

```
{"error":"invalid_client","error_description":"Client authentication failed."}
401
{"error":"invalid_client","error_description":"Client authentication failed."}
401
-[ RECORD 1 ]+--------------------------------------------------------------
event_type   | authentication
action       | client.authenticate
outcome      | refused
actor_client | demo-backend
request_id   | introspect-refused-wrong-secret
detail       | {"method": "client_secret_basic", "reason": "bad_credential"}
```

Every one of these rows spends its client's budget: twenty rows per
registered client per minute, the twentieth saying `rate_limited`, and a
`warn` line for each refusal after that until the window reopens. That
covers refusals after authentication as much as failed authentication,
because a public client authenticates with its name alone. `demo-spa` is
public, so anybody can post guessed refresh tokens under it; twenty-two of
them, with no refusal from `demo-spa` in the minute before:

```bash
for n in $(seq 1 22); do
  curl -sS -o /dev/null -w '%{http_code} ' -H "x-request-id: public-spray-$n" \
    --data-urlencode 'grant_type=refresh_token' --data-urlencode "refresh_token=guess-$n" \
    --data-urlencode 'client_id=demo-spa' "$BASE/token"
done; echo
docker compose exec -T postgres psql -U odudu -d odudu -c \
  "select e.action, e.detail->>'reason' as reason, count(*)
     from audit_events e
    where e.request_id like 'public-spray-%'
    group by 1, 2 order by 3 desc;"
docker compose logs odudu --since 2m | grep -c 'audit budget for this client is spent'
```

```
400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400
    action     |    reason     | count
---------------+---------------+-------
 token.refresh | invalid_grant |    19
 token.refresh | rate_limited  |     1
(2 rows)

2
```

Every answer is the same `400`; the budget decides only whether a refusal
is a row or a log line. The budget lives in one process's memory, so each
replica keeps its own ([ADR 0037](https://github.com/wizzywit/odudu/blob/main/docs/adr/0037-refusal-rows-are-bounded-by-the-principal-they-name.md)
plans the shared one for running several instances).
