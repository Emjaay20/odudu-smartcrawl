---
title: 'Theme: draft, publish, versions, restore, reset'
description: 'A tenant’s branding, and a client’s over it, saved as a draft and published whole. manage-tenant for the tenant, manage-clients for a client.'
---

# Theme: draft, publish, versions, restore, reset

This page covers `GET /theme`, `PUT /theme`, `POST /theme/publish`, `GET /theme/versions`, `POST /theme/versions/{versionId}/restore`, `DELETE /theme`, `GET /clients/:id/theme`, `PUT /clients/:id/theme`, `POST /clients/:id/theme/publish`, `GET /clients/:id/theme/versions`, `POST /clients/:id/theme/versions/{versionId}/restore` and `DELETE /clients/:id/theme`.

**No captured output yet.** The theme API is built and tested against a real
database, but a transcript of it needs a published theme to render against, and
the stack that captures these pages has not been run with one. This page says
what the routes do and holds no response that nobody produced; the captured
requests are added when the branding transcripts are.

The tenant's own theme needs `manage-tenant` and a client's `manage-clients`,
the capability every other client route needs. A client is named by its row `id`;
one of another tenant, or that does not exist, answers `404`.

- `GET /theme` answers the draft, the published version, and for each piece the
  layer that supplies it: `sources` for what users see now, `draft_sources` for
  what publishing the draft would give. A layer is `client`, `tenant` or
  `default`. A client's pieces fall back to the tenant's, one piece at a time.
- `PUT /theme` saves the whole draft. The first draft of a scope needs no
  `If-Match`; once one exists the write must send the draft's `ETag`, refused with
  `428` when it is missing or `*` and with `412` when it is stale, leaving the
  draft as it was. A body over 4 MiB is refused with `413` before it is read.
  Templates, stylesheet and images are checked as they are on publish, except
  contrast. A refusal is `400` with `errors`, each carrying `path`, `code` and,
  for a template or stylesheet, `detail`, `line` and `column`; `detail` quotes
  what the author wrote, cut to 80 characters and cleaned of control characters.
  A `{{t "key"}}` the page's catalogue does not hold is refused.
- `POST /theme/publish` runs every check again. A text or UI contrast pair
  below its ratio is a `400` naming the colour (`tokens.light.inkMuted`). A
  stylesheet or a template cannot be proven accessible, so each is a `warnings`
  entry, which does not block. `409` (`about:blank#theme-no-draft`) when there
  is no draft, which is also what the second of two simultaneous publishes of
  one draft receives.
- `GET /theme/versions` lists at most 20 versions, newest first, without bodies.
- `POST /theme/versions/{versionId}/restore` publishes a copy of an earlier
  version, whole, and leaves the draft alone. Refused with `409`
  (`about:blank#theme-assets-missing`) when an image it names has been deleted.
- `DELETE /theme` deletes the draft and archives the published version, so the
  tenant shows the default and a client shows its tenant's theme. History is kept.

A publish, a restore and a reset take effect on the next page this process
renders; another replica shows the previous theme for at most 30 seconds, the
lifetime of its cache. Deleting a client or a tenant drops the cache the same
way. A tenant has no rename, so nothing else changes what a cached theme names.
Each write is audited as `theme.draft_saved`, `theme.published`, `theme.restored`
or `theme.reset`, with ids and versions and never the theme itself.
