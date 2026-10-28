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
- **Statements.** The flag rides on the `clients` row the route already read, so
  the cost of a logout that asks did not change. Asking about a hint is five data
  statements (the tenant row, the browser's sessions, the signing keys the hint is
  verified against, the client row and its redirect list); with no hint the keys are
  not read, so four. A skip that ends adds the end's seven (session update, audit
  event-type read, audit insert, grant revoke, back-channel client read, signing-key
  read for the logout token, delivery insert) and one front-channel client read:
  thirteen. `logout.int.test.ts` asserts five, four and thirteen through the driver's
  query hook. `pnpm test:plans` still passes, but its end-session drive posts the
  confirmation form and does not reach a skip, so the plan check does not cover
  the skipping path; no new index is needed, since no new predicate is read.
- **Expired hints skip too.** Every logout hint is read with `exp` unjudged (the spec
  accepts an expired hint to identify a session), and the skip reuses that reading, so
  a lapsed ID token for a live session of a skipping client still signs it out. The
  console's own ID tokens last five minutes and its sign-out can come later, which is
  why `exp` is not required. The spec's warning beside the setting names expired
  tokens, so the text and the behaviour agree; whether to require `exp` for the skip
  and exempt the console stays open for the owner.
- **Dynamic Client Registration** refuses the member by name
  (`invalid_client_metadata`) rather than dropping it. There is no registration
  update path, so registration is the only door.
- **The tenant document carries it.** Export writes it and import reads it
  (`manage-tenants`, the broadest capability); a document exported before the
  setting existed has no member and imports with it off.
- **Import turns the flag on with count-level audit.** An import that sets
  `skip_logout_confirmation` on a client is audited as `tenant.import` with counts
  only, not as the per-field `client.create` diff the admin API writes, so the
  setting appearing through an import is visible in the new tenant's clients and
  not in its trail.

## Owed at phase close

| Owed                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Owner   | Why not yet                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A transcript of the public brand route: the stylesheet and logo a themed page links, fetched on a live stack and re-run against the build.                                                                                                                                                                                                                                                                                                                                | Task 26 | No route publishes a theme until the admin API exists, so there is nothing to serve.                                                                                                                       |
| Captured transcripts of the twelve theme routes (draft, publish, versions, restore, reset, for the tenant and for a client) and the image upload and delete, re-run on a live stack, with the admin-paths page `get-theme-put-theme-and-the-theme-routes.md` rewritten around them. The page now says it holds no output.                                                                                                                                                 | Task 26 | The stack that captures these pages was not run with a theme.                                                                                                                                              |
| The OpenAPI transcript's `content-length`, its path count and its KB figure were set from the generated document, and its `Date` and `x-request-id` are from the earlier capture. Re-capture `GET /admin/openapi.json` with the rest.                                                                                                                                                                                                                                     | Task 26 | Same stack. The figures are what `buildAdminOpenApiDocument` serialises to, which the test derives.                                                                                                        |
| The admin router validates a body before it authenticates (the image upload is the exception: it authenticates and checks its size in `onRequest`, before the body is read), so an unauthenticated caller makes the server buffer and validate up to 4 MiB on a theme `PUT` (16 MiB on a tenant import) and reads schema details in a `400` where a `401` belongs (`packages/protocol-admin/src/view/routes/router.ts`). Proposed owner: P11, with the other load bounds. | P11     | Not placed in `docs/NEXT.md`: a placement there must have its roadmap line and section 11 criterion, and `tests/docs/roadmap-section-11.test.ts` fails without them; adding P11 scope is the owner's call. |
