# Initiating User Registration via OpenID Connect 1.0

**Status in Odudu:** in scope for P4g in full. The specification (Final,
2 December 2022) defines one `prompt` value, `create`, and one discovery
member, `prompt_values_supported`. §1 (Introduction), §2 (Requirements
Notation), §3 (Terminology), §5 (Security Considerations, which only
refers to RFC 9101) and §6 (References) impose nothing of their own and
are out of this table's scope. §4's single paragraph of behaviour, §4.1's
request handling and §4.2's metadata are tabled below.

## Reading notes

The whole specification is a client telling the OP that "the user desires
to create a new account rather than authenticate an existing identity", so
that the person is not left "finding the sign-up link on the default login
page". Odudu already serves that page and already links to it from the
sign-in form, carrying the parked request as `return_to`
(`packages/protocol-oidc/src/service/login-ways.ts`). `prompt=create` is
therefore the same journey entered one step later: `/authorize` validates
and parks the request exactly as it would for a login, then answers `303`
to the registration page with the same `return_to` the link would have
carried (`accountPagePath`, the one builder both share), and sets the same
sign-in cookie a login page sets, so a verification mail can name the
request (`docs/phases/p4g.md`, the mailed-link resume). Nothing is
rendered by `/authorize` itself and no second registration page exists.

### `create` travels alone

§4 says only that "care must be taken if combining this value with other
prompt values" and that it is RECOMMENDED that `create` "not be combined
with any other values", because "mutually exclusive conditions can arise".
Odudu takes the recommendation as a rule: a `prompt` naming `create`
beside anything else is refused as `invalid_request` with the fixed
description `prompt is not valid`, the same answer OIDC Core §3.1.2.1
gives `none` beside another value (`parsePrompt`,
`packages/protocol-oidc/src/service/prompt.ts`). The alternative, keeping
`create` and dropping the rest, would have the server decide what
`create select_account` or `create none` meant; refusing says the client
must. `create consent` is refused with them, deliberately: the parked
request is rebuilt as a sign-in afterwards (below), and a consent gate on
that sign-in answers to the client's own settings, not to a value the
registration page could never honour.

### The tenant decides, and discovery says so

§4.2: "if an OpenID Provider supports this specification it MUST define
this metadata element", and when it does "the OP must also specify all
other prompt values which it supports". Odudu's document therefore always
carries `prompt_values_supported` with the four OIDC Core values, and adds
`create` only for a tenant whose `registration_allowed` is on and which is
enabled, because that is the only tenant that serves the page the value
leads to (`promptValuesSupported`, `packages/contracts/src/discovery.ts`,
read by both the document and the parser). The document and the
authorization endpoint read the same setting, so a client that trusts
discovery is never sent to a page that answers 404.

On a tenant whose document leaves `create` out, §4.1 applies: "if the
OpenID Provider receives a prompt value that it does not support (not
declared in the `prompt_values_supported` metadata field) the OP SHOULD
respond with an HTTP 400 (Bad Request) status code and an error value of
`invalid_request`", and it is RECOMMENDED that `error_description`
identify the invalid value. Odudu answers `invalid_request` with the fixed
description `prompt=create is not supported: registration is off`, and
delivers it the way every refusal below the RFC 6749 §4.1.2.1 boundary is
delivered: a `302` to the validated `redirect_uri`, with `state` and
`iss`, never a `400` page, because the client is known and can be told
(`docs/protocols/rfc6749.md`). The description is static, as every
`AUTHORIZE_REQUEST_DESCRIPTIONS` entry is, and never echoes the request.

### After the account exists

§4.1: "whether the AS creates a brand new identity or helps the user
authenticate an identity they already have is out of scope", and "this
flow MUST NOT be considered successful without the return of a valid
`id_token`". Odudu's registration page creates nothing until the person
confirms the mailed link (where `verify_email` is on) and signs nobody in.
What brings the person back is the `return_to` path, rebuilt from the
parked request by `restartAuthorizeLocation`
(`packages/protocol-oidc/src/service/restart-request.ts`) with `create`
replaced by `login`: the request comes back as a sign-in that asks for
credentials, so the account the person just made is the one that signs in,
rather than whichever session the browser already held. The client then
receives its code at its own `redirect_uri` with its own `state`, and
`nonce` in the ID token, through the ordinary login POST. A browser that
already holds a live session is shown the registration page all the same:
the client asked for it, and no code is issued from the session.

`prompt=none` can never reach any of this: `none` beside `create` is
refused as a combination (OIDC Core §3.1.2.1), and `none` alone never asks
for a page. An `id_token_hint` or a `claims` `sub` beside `create` is
accepted and parked, but the rebuilt path then carries no `return_to`, as
it does not for the sign-in form's own link: a request bound to one
subject cannot be rebuilt without the hint, and the registration page
shows no way back rather than a wrong one.

### What the OIDF conformance plans send

The Basic, Config and Dynamic OP plans send `prompt=none` and
`prompt=login` (`infra/conformance/README.md`) and read the discovery
document. None sends `create` or an undefined value, so adding the member
and the value changes no module's path; the member is OPTIONAL metadata
the suite does not validate, and its values are the four it already
exercises plus one it never sends.

## Clause table

| Clause | Level  | Requirement                                                                                                                                  | Test ID                     | Status                                                                                                                                       |
| ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 4      | SHOULD | `create` is not combined with any other `prompt` value, since mutually exclusive conditions can arise                                        | `OIDC-PROMPT-CREATE-4-01`   | covered                                                                                                                                      |
| 4.1    | MUST   | with `prompt=create`, the user is shown the account creation experience rather than the login experience, for every response type            | `OIDC-PROMPT-CREATE-4.1-01` | covered                                                                                                                                      |
| 4.1    | MUST   | the flow is not considered successful without the return of a valid `id_token`, or `id_token` and `access_token`                             | —                           | n/a: an obligation on the client; the OP issues tokens only through the ordinary code flow the person returns to                             |
| 4.1    | MUST   | for a request sent as a JWT, the `prompt` claim is a space-delimited set of prompt values                                                    | —                           | n/a: `request` and `request_uri` are refused (`docs/protocols/oidc-core.md`, `request_not_supported`), so no JWT-borne `prompt` is ever read |
| 4.1    | SHOULD | a `prompt` value the OP does not support, not declared in `prompt_values_supported`, is answered with HTTP 400 and `error` `invalid_request` | `OIDC-PROMPT-CREATE-4.1-02` | covered                                                                                                                                      |
| 4.1    | SHOULD | the `error_description` identifies the invalid parameter value                                                                               | `OIDC-PROMPT-CREATE-4.1-02` | covered                                                                                                                                      |
| 4.2    | MUST   | an OP that supports this specification defines `prompt_values_supported` in its discovery document, and `create` in it says so               | `OIDC-PROMPT-CREATE-4.2-01` | covered                                                                                                                                      |
| 4.2    | MUST   | when `prompt_values_supported` is defined, it also names every other `prompt` value the OP supports                                          | `OIDC-PROMPT-CREATE-4.2-01` | covered                                                                                                                                      |
