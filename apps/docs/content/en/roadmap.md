---
title: Roadmap
description: What Odudu does not do yet, the phase that brings each gap, and the decisions that mean it never will.
---

# Roadmap

Odudu is built in phases, and the table that defines them is section 11 of
[the design spec](https://github.com/wizzywit/odudu/blob/main/docs/superpowers/specs/2026-09-10-odudu-design.md).
This page lists what is missing today, and says for each gap whether it is
coming and when. A paid, hosted service beside the open-source server is
planned and has no date
([ADR 0042](https://github.com/wizzywit/odudu/blob/main/docs/adr/0042-distribution-licensing-and-the-paid-boundary.md));
nothing on this page depends on it.

## What is not implemented

Every item below is in one of two states, and says which: **planned**, with
the phase that brings it, or **a decision**, with the clause or the ADR that
settles it. Nothing here is unplaced, and
`tests/docs/not-implemented-placement.test.ts` fails the build on an item
that names neither a phase nor a decision, because an unplaced gap in a list
this long is indistinguishable from a forgotten one. The second phase of the
roadmap is two: **P2a** is the identity model — roles, groups, client scopes,
per-client web origins, email — and **P2b** is credentials, MFA and the
session lifecycle. A citation of either half here means that half.

**`/authorize`**

- **`display`, `claims_locales` and `login_hint` are accepted and ignored**,
  including values none of them define, such as `display=unheard_of`; every
  one of those requests answers 200 with the ordinary login form. A decision,
  not a gap: OIDC Core §15.1 asks of `display` that "the minimum level of
  support required for this parameter is simply that its use must not result
  in an error", and says the same of `claims_locales`, which stays ignored by
  decision ([ADR 0043](https://github.com/wizzywit/odudu/blob/main/docs/adr/0043-localization-is-a-catalogue-a-negotiation-and-a-set-of-owners.md)).
  `ui_locales` is not ignored: its tags that could be language tags (the first
  sixteen; anything else is dropped) are parked with the
  request and every page of the sign-in negotiates its language from them,
  then (once the subject's first factor is verified) the subject's own
  `locale`, then the browser's `Accept-Language`, then `en`; a page with no
  parked request (an error page, the logout pages, the account pages) uses
  `Accept-Language` alone; the answer is always one
  of the tags the server ships (`ui_locales_supported` in discovery), so a tag
  nobody ships changes nothing and refuses nothing. `<html lang>`, `dir` and
  `Content-Language` carry the negotiated tag, and a restart link rebuilds
  `ui_locales` with the rest of the parked request. Against the stack the
  transcripts build, which ships `en` only, with a preference list that names
  two languages it does not ship and a tag that is not one:

  ```bash
  curl -si -H 'accept-language: fr-CA, de;q=0.8' \
    "$BASE/auth?response_type=code&client_id=demo-spa&scope=openid&state=ui-locales-demo\
  &redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback&code_challenge_method=S256\
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM\
  &ui_locales=fr%20de%20%22%3E%3Cscript%3E" | grep -i -E '^content-language|<html'
  ```

  ```
  content-language: en
  <html lang="en" dir="ltr">
  ```

  Neither `fr` nor `de` is shipped, so the page is `en`, and the markup tag
  is not parked: only the two that could be tags are, which is what a restart
  link would rebuild `ui_locales` from. Scoped to this request's `state`:

  ```bash
  docker compose exec -T postgres psql -U odudu -d odudu -x -P 'null=(null)' -c \
    "select pending_request->'uiLocales' as ui_locales from authentication_sessions
      where pending_request->>'state' = 'ui-locales-demo'"
  ```

  ```
  -[ RECORD 1 ]------------
  ui_locales | ["fr", "de"]
  ```

  `login_hint` is OPTIONAL in §3.1.2.1
  and prefills a form this server does not prefill. `prompt` is deliberately
  not treated this way, because it is the one that changes whether the end
  user is asked anything at all.

- **`acr_values` is accepted and ignored on the request side.** §15.1 allows
  exactly that — "the minimum level of support required for this parameter
  is simply to have its use not result in an error" — so what happens today
  conforms. Every ID token now carries `acr` and `amr` describing the login
  that actually happened (`acrFor`/`amrFor`,
  `packages/protocol-oidc/src/service/acr.ts`) — `amr` names the RFC 8176
  values for the authenticators that ran (`pwd` for a password, nothing for
  an authenticator the registry has no accurate entry for), and `acr` is
  `'1'` for a single factor or `'2'` for two, including a passkey alone.
  Checking a _requested_ `acr_values` against a session, or forcing
  reauthentication to satisfy one, is step-up authentication: **P13**, whose
  criterion names it, beside PAR and DPoP and the FAPI 2.0 decision ADR 0016
  points at.
- **No request objects.** `request` and `request_uri` are refused explicitly,
  with `request_not_supported` and `request_uri_not_supported` — which is
  what OIDC Core §6.1 asks of an OP that does not support them, having first
  said "Support for the `request` parameter is OPTIONAL". Pushed
  authorization requests (PAR, RFC 9126) are **P13** for the same reason as
  DPoP: both are prerequisites of the FAPI 2.0 profiles ADR 0016 identifies,
  and P13's criterion is that plan passing, which neither omission survives.
- **PKCE is mandatory with no exception** and no per-client opt-out. This is
  a decision, not a gap: ADR 0016. A relying party that cannot do PKCE
  cannot use Odudu.
- **Only `response_type=code` and `response_mode=query`.** Also a decision.
  OAuth 2.1 removes the implicit grant, so OIDC Core's Implicit (§3.2) and
  Hybrid (§3.3) flows are out of scope by construction — the clause table in
  `docs/protocols/oidc-core.md` records them as `n/a` for that reason — and
  with no flow that returns a response in the fragment there is no second
  `response_mode` to offer. `response_modes_supported` states `["query"]`
  rather than being omitted so that the advertisement matches.
- **`resource` (RFC 8707 §2) is validated, and deliberately not checked for
  a query component** — a decision, recorded at `rfc8707.md`'s "A query
  component: the allowlist refuses it, the parser does not". A single value
  is checked as an absolute URI with no
  fragment, against the client's registered `audiences`; two values or one
  outside that list refuse with `error=invalid_target`, on the same
  post-boundary redirect every other refusal here uses
  (`parseResource`, `packages/protocol-oidc/src/service/resource-indicator.ts`).
  `?resource=` alone, and a repeat where one value is empty
  (`resource=<uri>&resource=`), both resolve as RFC 6749 §3.1 resolves any
  other empty-valued parameter here — as omitted — rather than as a
  refusal or a second value; only two genuinely distinct values are a
  repeat. Omitting it resolves to the client's whole registered list, and
  a client
  with no registered audience — every client the transcripts seed, and every
  one `seed client` can produce, since it has no `--audience` flag — still
  succeeds with an empty one rather than being refused.
  `PATCH /admin/tenants/{tenant}/clients/{id}` registers the list, and the
  built-in admin client is provisioned with one, so "no client has an
  audience" stopped being true of the server when the admin API landed. `[]` on the
  stored column has exactly one meaning: the resolved audience is empty,
  never "not carried" — every door that mints a code resolves and stores
  the same value: immediate session-reuse at `/authorize`, an ordinary
  first-time form login, the account chooser, and the consent step, which
  either a fresh login or a reuse promotion can detour through. The value
  is parked on the authentication session's own
  `PendingRequest.resource` between the request and whichever door
  completes it. `/token` now derives `aud` from this column — see the
  `resource` paragraph under [step 4](reference/transcripts/request-paths/path-a-authorization-code-with-pkce.md#4-token) of the walkthrough. What
  `parseResource` does not check is RFC 8707 §2's SHOULD that a `resource`
  value carry no query component — the registered-audience allowlist is
  what bounds the value instead, so the only query-bearing `resource` the
  server can accept is one an operator registered itself.

**Login**

- **Recovery codes are issued once and shown once.** Ten per subject, each
  Argon2id-hashed in its own credential row, offered by the
  `generate-recovery-codes` required action that enrolling a TOTP adds
  (a passkey owes none: a code is redeemed only at the TOTP code step). There is no way to see them again and no administrator
  surface that can print them, by construction rather than by omission.
  Spending the last one owes the action again, in the login that spent it —
  so a list runs out into a fresh set rather than into a lockout.
  What is not there yet: no way for a subject to ask for a fresh set _before_
  they run out, and no warning as the list gets short — self-service
  credential management is **P4f**'s "me" API and application-initiated
  actions. The same goes for **no notice mail when the subject enrols a factor
  or issues a set themselves**: an administrator's removal of a factor and
  revoke of a set are mailed to the address on file, and a subject's own
  changes are not (NIST SP 800-63B-4 §4.6 asks for both), which **P4f** brings
  with the self-service actions that make a regeneration an explicit event
  rather than a page render. And **no rate
  limit on re-issuing**: while the action is owed, each login submission
  with a valid password renders the page again, which costs ten Argon2id
  hashes and eleven row writes. Bounded by holding the password and by
  acknowledging the page, but a heavier multiplier than the verification one
  above; the per-account lockout counts failures and so reaches neither,
  and the per-origin throttle is what bounds both — ten submissions a
  minute per client address, which is a budget on the multiplier rather
  than a fix for it.
- **A password change or reset leaves every other session alive.** Neither
  the `update-password` action nor a redeemed reset link ends the subject's
  other sessions, and neither offers to — ASVS V3.3.3 asks that a subject be
  given that option after changing their password. Planned: **P4f**, whose
  self-service password change and "me" session list are where the offer
  belongs. An administrator can already end them all with
  `DELETE /admin/tenants/{tenant}/subjects/{id}/sessions`
  ([Admin paths](reference/transcripts/admin-paths/delete-subjectsidsessions.md)).

- **Every page this server renders is hardcoded HTML**, dependency-free with
  every interpolated value escaped: fifteen `*-html.ts` renderers across the
  `view` layers of `packages/protocol-oidc`, `packages/authn-flows`,
  `packages/account` and `packages/console-gateway`, from the sign-in form
  to the logged-out page and the console's refusal page. Theming
  and per-client branding are **P4b**, split out of P10 on 2026-09-17 because
  P10's criterion tested provider loading and would have passed with no
  theming at all. Its criterion names every renderer rather than a list of
  pages, and asks for a build check that fails when one exists that no theme
  reaches — an enumeration was three pages long while the code had twelve,
  which is how a themed sign-in page and an unthemed second-factor page could
  have satisfied it. The variation it has to cover is visible in **P2a**'s
  registration and verification pages, **P2b**'s second-factor,
  recovery-code, change-password and logout pages, and **P3a**'s own consent
  page.

**`/token`**

- **`token_exchange_impersonation_allowed` has no `seed client` flag and no
  registration field.** `PATCH /admin/tenants/{tenant}/clients/{id}` sets
  it, which is the door it did not have; [Path D](reference/transcripts/request-paths/path-d-token-exchange.md)
  still sets it with SQL, because that walkthrough holds no admin token.
  What remains is the CLI gap alone, and that is a decision — see the
  `seed client` row below for it.
- **No CIBA.** **P5**, whose exit criterion is CIBA approvals end to end.
- **No device authorization grant.** **P13**, whose criterion names a
  device-code client completing a login on a second device. It shares that
  phase with PAR, DPoP and step-up authentication for scheduling rather than
  for any protocol reason — RFC 8628 has nothing to do with FAPI, and the
  roadmap says so.
- **No resource owner password credentials.** A decision: the grant is
  removed by OAuth 2.1, and it is not coming back.
- **No DPoP or other sender-constrained tokens**, mTLS-bound tokens
  included. **P13**, as above: the FAPI 2.0 plan cannot pass without one of
  them.

**Client authentication**

- **No `client_secret_jwt`.** OIDC Core §9's HMAC-signed assertion is not
  accepted at `/token`, `/revoke` or `/introspect`, and is not a registrable
  `token_endpoint_auth_method`. **P13**, whose criterion is that every
  client authentication method in OIDC Core §9 and RFC 8705 is accepted at
  every authenticated endpoint. Verifying one needs the secret readable,
  where Odudu stores a hash only, so P13's spec decides its storage; the
  likely answer is that secret alone, encrypted at rest. Under P13's FAPI
  profile it is refused for a FAPI client and a FAPI tenant's discovery omits
  it.
- **No `self_signed_tls_client_auth`.** RFC 8705 §2.2's variant, where the
  certificate is matched to a key registered in the client's `jwks` rather
  than to a subject DN, is not accepted anywhere. **P13**, for the same
  criterion; the console's Advanced tab offers it there. Under the FAPI
  profile it is refused too, and a FAPI tenant's discovery omits it.

**`/userinfo`**

- **No aggregated or distributed claims.** A decision, and the specification
  is explicit: §5.6.2 says "Normal Claims MUST be supported. Support for
  Aggregated Claims and Distributed Claims is OPTIONAL." No phase is owed
  one.
- **A tenant can rebind a scope's mappers but cannot add one.**
  `PUT /admin/tenants/{tenant}/scopes/{id}/mappers`
  ([Admin paths](reference/transcripts/admin-paths/get-scopesidmappers-and-put-scopesidmappers.md))
  chooses which of the process's registered mappers a scope carries, which
  is the reconfiguration P4c owed. The registry itself —
  `standardClaimMappers`, the 22 names in `claims_supported`, and the
  role/group claims alongside them — is still fixed by the server: a mapper
  that computes a claim nothing in the registry computes cannot be defined
  by an operator. **P10**, whose criterion names it: a mapper an operator
  writes is code the server did not ship, which is the same problem as
  loading a provider without a rebuild, not a missing admin endpoint.
  `entitlements`, in particular, is deliberately never
  advertised: there is no notion of one in this identity model yet, and
  `packages/protocol-oidc/tests/claims-supported.int.test.ts` fails the
  build if it appears in a live discovery response.

**`/logout`**

- **A front-channel logout is delivered on neither branch that redirects.**
  `packages/protocol-oidc/src/usecase/logout.ts` computes the frame list only
  where `decision.redirectTo === null`, so a session ended with a matched
  `post_logout_redirect_uri` — RP-initiated logout's ordinary case — frames
  nothing, and a relying party registered with a `frontchannel_logout_uri`
  and no `backchannel_logout_uri` keeps its local session while the user
  believes they have logged out everywhere. Back-channel delivery is
  unaffected: `endSession` runs before the branch splits. ADR 0034 governs
  how a page declares its frames, not when one is rendered, so this is
  behaviour nobody chose rather than a decision. **P4b**, whose criterion
  names it: closing it means rendering the frames and navigating afterwards,
  which gives that branch the page it does not have today, and P4b is the
  phase whose criterion covers every page the server renders.

**The admin API**

- **The audit trail has two readers, the admin API and the console's Audit
  trail area, and no destination outside the database.** Every kind of row
  the vocabulary names is written —
  [one sign-in's trail](reference/transcripts/request-paths/one-sign-ins-audit-trail-read-through-the-admin-api.md)
  reads two of them back through `GET /admin/tenants/{tenant}/audit` — and
  the console shows them filtered, one page at a time, with the NDJSON
  export (`GET …/audit/export`,
  [Admin paths](reference/transcripts/admin-paths/get-auditcount-and-get-auditexport.md)) beside
  them. Nothing hands them to anything unasked: an `EventListener`
  delivering a tenant's events to a SIEM or a webhook is **P10**'s, whose
  criterion names one. A successful `/introspect` or `/userinfo` call writes
  no row, which is a decision (the P4e spec's §2): each is a read a resource
  server makes per request, and the grant it reads was recorded when it was
  issued.
- **A refused credential or session change writes no row.** A spent,
  expired or unknown reset or verification link, a password the policy
  refuses, a wrong code or refused passkey at enrolment, a refused
  registration and a logout that ends nothing all leave `audit_events`
  untouched, so `?event_type=credential&outcome=refused` returns nothing.
  A decision, in ADR 0037's amendment: a link's key is chosen by the
  caller and bounds nothing, a refused change on an authenticated session
  is form validation rather than an authentication decision, and a logout
  that ends nothing changes nothing. Login steps, `/token`, `/revoke`,
  `/introspect` and the admin API's own checks do record their refusals.
  The request log shows each such request's path and status, not its
  reason.

**Endpoints that do not exist at all**

- **`seed client` sets a fraction of what a client carries, and only at
  creation.** The [admin API](reference/transcripts/admin-paths/index.md) closed the surface this row
  used to aggregate — a client is created, amended, disabled, deleted and
  re-credentialled through it, a key rotated, a session ended, a flow
  reordered — so what is left here is the CLI's own reach, which matters
  because every transcript runs from a shell holding no
  admin token. `seed client` takes `--redirect-uri`,
  `--post-logout-redirect-uri`, `--web-origin`, `--client-secret`,
  `--token-endpoint-auth-method` and `--grant-type` (repeatable, validated
  against the same list `client_oidc_config_grant_types_check` enforces;
  omitted, a confidential client still gets `authorization_code`,
  `refresh_token` and `client_credentials`, and a public one the first two
  only), and nothing for `audiences`,
  `frontchannel_logout_uri`/`backchannel_logout_uri` or `consent_required`.
  `--token-endpoint-auth-method` itself only accepts `client_secret_basic`
  and `client_secret_post` (`apps/server/src/cli/seed-invocation.ts`) —
  there is no `--jwks`/`--jwks-uri` flag and no
  `--tls-client-auth-subject-dn` flag either, so `seed client` cannot
  produce a `private_key_jwt` or `tls_client_auth` client at all; the only
  route to either is dynamic client registration, on a tenant whose
  `clientRegistrationPolicy` allows it, or the admin API. The demo tenant
  opens neither to the transcripts, which is why no transcript
  exercises `private_key_jwt` or `tls_client_auth` the way [Redeeming the
  code with
  `client_secret_basic`](reference/transcripts/request-paths/path-a-as-a-confidential-client.md#redeeming-the-code-with-client_secret_basic) and
  its `client_secret_post` sibling exercise theirs — there is no seed
  command to run that would produce one, per the transcripts' own rule for a
  command that cannot be run. A second gap sits beside it: metadata a flag
  does set is only settable at creation, so a client already seeded is
  amended elsewhere. The three sites here that reach for SQL —
  [Front-channel and back-channel
  logout](reference/transcripts/request-paths/rp-initiated-logout.md#front-channel-and-back-channel-logout), [Token introspection and
  revocation](reference/transcripts/request-paths/rp-initiated-logout.md#token-introspection-and-revocation) and [Offline
  access](reference/transcripts/request-paths/rp-initiated-logout.md#offline-access) — each name the admin endpoint that now sets the
  same column, and reach for SQL anyway because a walkthrough that has to
  mint an admin token first is a different walkthrough.
  A decision, now that the admin API exists: `seed` is the bootstrap tool
  that creates the first of everything with no token in hand, and amendment
  belongs to the API. Widening the CLI to a second amendment surface would
  give every client column two doors to keep in step.
- **SAML, LDAP federation, identity brokering, authorization services.**
  P6–P9.
- **SCIM 2.0 inbound provisioning, and moving more than the 10,000
  subjects a tenant export carries.** P7. An export refuses a tenant above
  that size and names inbound provisioning as the tool for it.
- **The MCP authorization profile, and the guide "Protect an MCP server
  with Odudu".** P5a. The server publishes no authorization-server metadata
  at the RFC 8414 well-known path (`/.well-known/oauth-authorization-server`
  answers 404), no protected-resource metadata for an MCP server (RFC 9728,
  `/.well-known/oauth-protected-resource`), and keeps dynamic client
  registration closed until a tenant's policy or a registration token opens
  it, with no registration policy written for MCP clients. P5a builds those
  and writes the guide against the passing profile.

**Operational**

- **TLS is terminated in front of this server, never by it.** A deployment
  decision rather than a gap, and one the server enforces: it speaks plain
  HTTP, and with `NODE_ENV=production` refuses to boot until `ODUDU_TLS=true`
  asserts that something in front of it is doing that job. Consequently the
  issuer is `http://` on the local stack, and the session cookie drops its
  `__Host-` prefix and `Secure` attribute (ADR 0020) — correct for local
  development, unacceptable anywhere else.
- **One instance only.** Migrations run on boot from every process with no
  advisory lock, so replicas would race, and the per-origin throttle is a
  window in one process's memory, so replicas would each allow the full
  budget. **P11**, whose criterion now names both.
- **Neither outbound DNS lookup carries a deadline.**
  `apps/server/src/logout-delivery-transport.ts` and
  `apps/server/src/client-key-transport.ts` both call `node:dns/promises`'s
  `lookup` with no timeout, the first also ignoring the `AbortSignal`
  `sendLogouts` started; the second sits on `/token`'s `private_key_jwt`
  authentication and, since encrypted UserInfo responses landed, on
  `/userinfo` — between a resource server's request and its answer. **P11**,
  whose criterion documents a p99 for those two paths and so cannot be met
  while an unbounded lookup sits on either.
- **No published image or release process.** **P4g**, Public release (moved
  there from P12 on 2026-10-09). Publishing an image waits on nothing, and
  `README.md` says what can be pulled forward.
- **No secret store beyond the process environment, and no backup or restore
  guidance.** **P12**, Operational readiness, appended on 2026-09-14 because
  none of it had a phase.
- **Expired state is deleted, on a window per table, by one pass** —
  `odudu reap`, on the server's own schedule or as a command
  ([Retention](reference/transcripts/request-paths/retention-what-odudu-reap-removes.md)). What is not there yet:
  nothing bounds `refresh_tokens` on its own, because a refresh token is
  retained for the life of its grant family and ADR 0021 says why deleting
  on `expires_at` alone would silently disable reuse detection; and the pass
  discovers a misconfigured serving role once per tick rather than at boot,
  so a deployment that sets `ODUDU_APP_DATABASE_URL` to a role that escapes
  row-level security learns about it from an hourly log line — a decision
  rather than an oversight, and ADR 0024 records it as the one precondition
  bought at that price to keep the loop free of logic.

**Administrative capabilities placed by the P4d gap audit**

An audit of Odudu's admin API against Keycloak's, Auth0's and Okta's
operator surfaces found capabilities the server does not have yet, and no
phase owned them. Each is now named in its phase's exit criterion in design
spec §11. `tests/docs/gap-audit-placement.test.ts` fails the build when an
item here names a phase whose §11 criterion does not name it too. The audit
also found admin routes and configuration for features the server already
has; those are P4d's own work and are not listed here.

- **more required actions (verify email, update profile, accept terms)**:
  P4f.
- **several sign-in flows with a per-client override**: P4f.
- **per-step authenticator configuration**: P4f.
- **a password blocklist and breach check**: P4f.
- **translated pages and mail**: P4b, which ships the locales on the catalogue mechanism the server already has; the console's catalogue is P4h's (ADR 0043).
- **custom subject attributes and a declarative user profile**: P7.
- **fine-grained admin permissions**: P9.
- **per-client dedicated mappers**: P10.
- **a metrics endpoint**: P11.
- **key import, encryption keys and scheduled key rotation**: P12.
- **client registration policies and client policies**: P13.
- **admin impersonation**: P13, with its own threat model.
