---
title: Roadmap
description: What Odudu does today, what comes next and in what order, what is planned for later, and what it will never do.
---

# Roadmap

You are deciding whether Odudu does what you need, today or soon. This page answers in one screen: what you can use now, what is being built next, what is planned after that, and what Odudu has decided not to do. Odudu is built in phases, and the table that orders them is section 11 of
[the design spec](https://github.com/wizzywit/odudu/blob/main/docs/superpowers/specs/2026-09-10-odudu-design.md).
A paid, hosted service beside the open-source server is planned and has no date
([ADR 0042](https://github.com/wizzywit/odudu/blob/main/docs/adr/0042-distribution-licensing-and-the-paid-boundary.md));
nothing on this page depends on it.

| Today                                                                                                              | Next, in this order                                                                   | Later                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sign-in and tokens, many tenants, passwords, passkeys and recovery codes, an admin API and console, an audit trail | This release, theming, an MCP server, self-service, a localized console, agent access | Brokering, LDAP and SCIM, SAML, authorization services, extensibility, many instances, FAPI |

## Shipped

Everything here works in the version you can run today.

### Sign-in and tokens

- The authorization code flow with PKCE, always required, with discovery, signing keys, user info, introspection and revocation for every tenant.
- Refresh tokens that rotate, a stolen one caught on reuse, and offline access.
- Client credentials, and token exchange for acting on someone's behalf.
- RP-initiated logout with back-channel logout delivered to the apps that registered. Front-channel logout frames are shown on every logout; when the request names a matched post-logout redirect, the browser is sent there once the frames have loaded.
- Single sign-on across the apps of one tenant, through one Odudu session.
- "Remember me" and several sessions per browser, consent, and client registration by hand or by an app itself with a registration token.
- Client authentication by secret, by signed assertion (`private_key_jwt`), by mutual TLS (`tls_client_auth`, when a proxy forwards the certificate and `ODUDU_TRUST_PROXY` is on), or by nothing for a public app.

### Many tenants

- Any number of tenants on one server, each with its own people, clients, keys, settings, sign-in flow and mail relay, kept apart by the database itself.
- Gap-free signing key rotation, and export of a tenant to a file and import as a new tenant.
- Built-in scopes, like any other, can be deleted after typing their name, and restored.

### Credentials and second factors

- Passwords with a policy and lockouts, a list of common passwords that may not be chosen, passkeys, and a one-time password from an authenticator app.
- Recovery codes: ten per person, shown once, offered again when the last is spent, revoked as a set when the last authenticator goes.
- Self-registration, email verification and password reset, each switched on per tenant, and required actions you set on a person. An app can send a person straight to the registration page with `prompt=create`. Registering with an address that is taken does not say so when verification is on, and a reset ends every session and token the person had.

### Admin API and console

- An admin API of more than a hundred operations, each checked against the capability it needs on every request.
- An admin console with a page for every area ([the tour](admin-console/tour.mdx)).

### Audit

- Every administrative change, sign-in, refusal, token and credential change is recorded, filterable, exportable as one JSON object per line, and kept for a window you set.

### Running it

- Postgres with migrations applied at boot, health endpoints, one instance with TLS ended in front, with the issuer and every cookie taken from your configuration.
- The container image and the Docker Compose quick start are built from source today; the first release, P4g (this release), publishes them.

## Next

These are the phases being built, in the order the design spec gives. Each one says what it brings you.

- **P4g, this release.** A published, signed container image with its contents listed and its base images pinned, the one-file Docker Compose quick start that pulls it, a written release process, this documentation site, a landing page and worked examples. Until it ships there is no published image or release process to rely on.
- **P4b, theming and client branding.** Every page the server shows, today plain built-in HTML, will render in a tenant's theme and a client's branding. A tenant sets its own logo, colours, wording and default language, and its mail follows the same theme. It also closes two logout gaps: the confirmation form's client and redirect fields are bound into its anti-forgery token, and a decision is recorded on whether a leaked ID token for a live session should be able to force that sign-out with no confirmation. Translated pages and mail arrive with it.
- **P5a, an MCP server.** The admin API as tools for an AI agent, read-only by default and held to the same capabilities as everyone else, with the authorization-server and protected-resource metadata an MCP client looks for, which the server does not publish yet, and a guide to protecting an MCP server with Odudu. Retries are made safe for an agent in the same phase: an `Idempotency-Key` header on the admin API's creates and other non-idempotent actions, and on the tools that call them, so a repeated request returns the stored response instead of acting twice; the same key with a different request is refused, and a duplicate still in flight is refused. Today the admin API has no such header, and a replayed write guarded by `If-Match` answers 412 only because its tag has gone stale.
- **P4f, self-service.** A "me" API through which an application lets a person read and change their own profile, credentials, sessions and consents, and application-initiated actions such as changing a password or enrolling an authenticator. It is also where the missing pieces of credential management live: asking for a fresh set of recovery codes before the old set runs out, a warning when it is short, a notice mail when a person enrols a factor themselves, a way to ask for a new verification email when a link has expired or been used, a place to return to for a mailed link an administrator issued, which no application started and so carries no request to go back to, and the offer to end a person's other sessions after a password change or reset (an administrator can end them today). Re-issuing recovery codes while the action is owed costs ten Argon2id hashes per login submission and is bounded only by the per-origin throttle.
- **P4h, a localized console.** Every string in the admin console read from a catalogue, a language switch, and right-to-left layouts.
- **P4i, SDKs for signing in and for the admin API.** Official libraries, so an app does not hand-roll the protocol: a framework-neutral JavaScript core, a React package with a provider and hooks, a Next.js package for server-side sessions, and Node middleware that verifies Odudu's access tokens. A single-page app can run through a backend-for-frontend, the pattern RFC 10017 recommends for browser apps. A typed admin API client is generated from the published OpenAPI document, in TypeScript and Python. Each ships with a guide and a runnable example in CI, and is versioned apart from the server. They wrap what exists: discovery, authorization code with PKCE, refresh, `prompt=create`, logout and the "me" API.
- **P5, agent identity.** Budgets, attenuation and approval for AI agents acting for a person, including CIBA, which Odudu does not have today.
- **P5b, destructive MCP tools.** The irreversible tools P5a withholds, each needing the owner's separate approval.

After P4f an application can adopt Odudu with every page branded and every session endable. What an operator still needs before running it in production is P11 and P12 below.

## Later

Placed on a phase, in order, and not started. Each line names the phase that will do it.

- **P6, identity brokering.** Sign in with Google or another upstream OpenID Connect provider.
- **P7, user federation and inbound provisioning.** LDAP-backed sign-in, SCIM 2.0 inbound provisioning, and moving more than the 10,000 subjects a tenant export carries; an export refuses a tenant above that size and names this as the way.
- **P8, SAML 2.0.** Odudu as a SAML identity provider.
- **P9, authorization services.** Policy evaluation and UMA 2.0, and a resource server as a first-class thing.
- **P10, extensibility.** Third-party providers loaded without a rebuild. A tenant can choose which claim mappers a scope carries but cannot add a new mapper, and an `EventListener` delivering audit events to a SIEM or a webhook belongs here: today only the admin API and the console read the trail.
- **P11, many instances and performance.** One instance only today, because migrations run at boot with no lock and the throttle, the per-address mail limit and the limits on registration and reset links live in one process. Also a deadline for the two outbound lookups on `/token` and `/userinfo`, and a metrics endpoint. Audit events are partitioned by month so retention drops a partition, and deleting a tenant becomes chunked and resumable. A Helm chart or Kubernetes manifests come with it.
- **P12, operational readiness.** Secrets read from somewhere other than the process environment, written backup and restore guidance proven by a restore, and a start-up check that the serving role is neither a superuser nor able to bypass row-level security.
- **P13, FAPI 2.0 and the deferred grants.** Pushed authorization requests (PAR), so request objects are refused until then; DPoP and mTLS-bound tokens; the device authorization grant; `client_secret_jwt` and `self_signed_tls_client_auth` client authentication; and a requested `acr_values` that forces re-authentication, which is accepted and ignored today.
- **P14, SDK breadth and headless sign-in.** More platforms: Vue, Svelte and Angular bindings; native mobile on iOS, Android, Flutter and React Native, using the system browser as RFC 8252 requires; and token verifiers for Go, Java, .NET, PHP and Ruby. Headless sign-in components, which need a flow API the server does not have, so every sign-in page stays server-rendered until it does. An agent library for delegation, covering token exchange and `act` chains, once P5 fixes their shape.

**Smaller capabilities, each placed on a phase**

- **more required actions (verify email, update profile, accept terms)**: P4f.
- **ending a person's other sessions after a mailed required-action link sets a password**: P4f.
- **a tenant-wide switch that asks everyone to enrol a passkey**: P4f.
- **several sign-in flows with a per-client override**: P4f.
- **per-step authenticator configuration**: P4f.
- **a breached-password check**: P4f.
- **translated pages and mail**: P4b, which ships the locales on the catalogue mechanism the server already has; the console's catalogue is P4h's (ADR 0043).
- **a public address of its own for each tenant (a custom domain)**: P4b, as part of a tenant's brand. Today one `ODUDU_PUBLIC_BASE_URL` serves every tenant as `/tenants/<name>`, and a tenant's issuer is that base plus its name.
- **custom subject attributes and a declarative user profile**: P7.
- **fine-grained admin permissions**: P9.
- **per-client dedicated mappers**: P10.
- **a metrics endpoint**: P11.
- **key import, encryption keys and scheduled key rotation**: P12.
- **an audit trail the serving role cannot rewrite, signed or chained**: P12.
- **client registration policies and client policies**: P13.
- **admin impersonation**: P13, with its own threat model.
- **create a client's service account when its client credentials grant is switched on, not for every confidential client**: P5a, because machine clients and agents are the ones that use `client_credentials`, following Keycloak's model. Today every confidential client gets one.

## Decided against, and why

These are choices, not gaps. Each names the decision.

- **PKCE is mandatory, with no opt-out** (ADR 0016). An app that cannot do PKCE cannot use Odudu.
- **Only `response_type=code` and `response_mode=query`** (ADR 0016). OAuth 2.1 removes the implicit grant, so the implicit and hybrid flows are out by design.
- **No resource owner password credentials grant**, a decision: OAuth 2.1 removed it and it is not coming back.
- **`display`, `claims_locales` and `login_hint` are accepted and ignored** (ADR 0043 for the locale one). The specification asks only that they not cause an error. `ui_locales` is honoured.
- **`resource` is validated against the client's registered audiences and not refused for a query component**, a decision: the registered list is what bounds the value.
- **No aggregated or distributed claims**, a decision: the specification makes them optional.
- **A person's password is not chosen in the console or the admin API**, a decision: a new subject owes a password change and the console issues a one-time password, so no operator handles a password. `odudu seed user --password` is the bootstrap exception.
- **`odudu seed` creates the first of everything and does not amend** (a decision): once the admin API exists, changing a client belongs to it, so a client column has one door and not two. Its client flags cover what an application needs on day one: redirect and post-logout addresses, web origins, grants, consent and service scopes. It has none for audiences, back-channel logout or impersonation, and cannot create a `private_key_jwt` or `tls_client_auth` client; use the admin API or dynamic registration.
- **A refused credential or session change writes no audit row**, ADR 0037's amendment: a link's key is chosen by the caller, and a refused change on a signed-in session is form validation. Sign-in steps, the token endpoints and the admin API do record their refusals.
- **A successful `/introspect` or `/userinfo` call writes no row**, a decision: each is a read a resource server makes per request, and the grant was recorded when it was issued.
- **TLS is ended in front of the server, never by it** (ADR 0020): in production the server refuses to boot until you assert that something in front does it.
- **Expired state is deleted by one pass on a window per table** (ADR 0024, ADR 0021): `odudu reap`, run by the server or by your scheduler. A refresh token is kept for the life of its grant family, because deleting it sooner would disable reuse detection.
- **Four operator commands have no button in the console** (ADR 0024, a decision). `odudu reap`, `odudu send-mail` and `odudu send-logouts` are passes the server runs on its own schedule, which a deployment may switch off (`ODUDU_REAP_ENABLED`, `ODUDU_OUTBOX_ENABLED`, `ODUDU_LOGOUT_SENDER_ENABLED`) and schedule itself. `odudu client-origins rebuild` is run once after an upgrade that adds client origins.
- **No sign-in form that runs in an app's own page, and so no password in an app's code** (a decision, until P14's flow API exists): an app's SDK sends the person to Odudu's pages, which keep the one content-security policy and one anti-forgery rule that protect a credential.
- **A paid, hosted layer, never required** (ADR 0042): planned, with no date, and nothing in the open product waits on it.
