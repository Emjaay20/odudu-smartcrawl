# P4b — theming and client branding

What the phase found while building it, in the shape `docs/phases/p4g.md`
follows. The phase's argument is in
[its design](../superpowers/specs/2026-10-27-p4b-theming-and-client-branding-design.md)
and [its plan](../superpowers/plans/2026-10-27-p4b-theming-and-client-branding.md).

Started 2026-10-27.

## Placement

The custom domain per tenant left P4b for a new phase, P4j, straight after it
(design section 3). P4j's 20–35 h is an estimate to refine in P4j's own
brainstorm. Liquid-style template logic went to the roadmap's "Decided against",
to be revisited when a user asks for it. P4b's own hours (81–134 h) are
unchanged and are set at the end of the phase from what the increments cost.

## The logout form's fields were outside its token

The confirmation form carried `client_id`, `post_logout_redirect_uri` and
`state` as hidden fields that the `csrf` value did not cover, so a form edited
after it was issued still verified. `SessionEntry.proof` now takes the bound
values, each length-prefixed, and the confirmation passes all three on issue and
verify. A caller that posts back only some of the fields now fails: the
plan-drive for the end-session path did, and was changed to post every hidden
field, and so did the front-channel transcript's request, which omitted
`client_id`. The decision is ADR 0047.

## The per-client opt-out of the logout confirmation

`clients.skip_logout_confirmation` (migration 0106) is off by default and on for
every built-in admin client, which is the console's: the migration sets it
`WHERE builtin_admin`, and `provisionAdminClient` creates the client with it on.
That client is guarded on the admin API like every field outside
`BUILTIN_ADMIN_AMENDABLE_FIELDS`, so nobody can turn it off.

- **Decision shape.** `decideLogout` takes `{ session, hint, client, redirect }`.
  `session` is `{ id } | null` rather than a boolean, because the rule compares
  the hint's `sid` with the live session's id and a boolean cannot carry it.
  `ValidHint` is built from a hint that verified and names exactly one audience
  and a `sid`; a hint with several audiences is no hint for this purpose.
- **One path ends a session.** The confirmation `POST` and a skipping first
  contact both call `endAndAnswer`, so the redirect rule, the frames, the
  back-channel enqueue and the cleared cookies are the same code. `handleLogoutRequest`
  therefore takes the request context an end needs for its audit row.
- **Statements.** The flag rides on the `clients` row the route already read, so a
  logout that asks makes the same five statements it did (tenant, session, signing
  keys, client, redirect list). One that skips adds the end's own seven (session
  update, audit-type read, audit insert, grant revoke, back-channel and front-channel
  client reads, delivery insert) and one frame-client read: thirteen in all, the
  confirmation `POST`'s set plus the keys read. Measured with `log_statement = 'all'`
  on a Testcontainers database; no new index, and `pnpm test:plans` still passes.
- **Expired hints skip too.** Every logout hint is read with `exp` unjudged (the spec
  accepts an expired hint to identify a session), and the skip reuses that reading, so
  a lapsed ID token for a live session of a skipping client still signs it out. The
  console's own ID tokens last five minutes and its sign-out can come later, which is
  why `exp` is not required. The warning beside the setting says "still-valid"; the
  `exp` question is whether to require it for the skip and exempt the console, and is
  open for the owner.
- **Dynamic Client Registration** refuses the member by name
  (`invalid_client_metadata`) rather than dropping it. There is no registration
  update path, so registration is the only door.
- **The tenant document carries it.** Export writes it and import reads it
  (`manage-tenants`, the broadest capability); a document exported before the
  setting existed has no member and imports with it off.
