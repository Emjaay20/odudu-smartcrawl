---
title: 'Theme: draft, publish, versions, restore, reset'
description: 'A tenant’s branding, and a client’s over it, saved as a draft and published whole. manage-tenant for the tenant, manage-clients for a client.'
---

# Theme: draft, publish, versions, restore, reset

This page covers `GET /theme`, `PUT /theme`, `POST /theme/publish`, `GET /theme/versions`, `POST /theme/versions/{versionId}/restore`, `DELETE /theme`, `GET /theme/preview`, `GET /clients/:id/theme`, `PUT /clients/:id/theme`, `POST /clients/:id/theme/publish`, `GET /clients/:id/theme/versions`, `POST /clients/:id/theme/versions/{versionId}/restore`, `DELETE /clients/:id/theme` and `GET /clients/:id/theme/preview`, and the tenant's image routes `POST /theme/assets` and `DELETE /theme/assets/{assetId}`.

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
- `GET /theme/preview?kind=&scheme=` (and `GET /clients/:id/theme/preview`) answers one
  page of the draft as an HTML document: the page kind (`sign-in` when left out)
  rendered by the same code users are sent, with sample values, in the `light`
  or `dark` palette if `scheme` asks. A client's draft is shown over its tenant's
  published theme, and a scope with no draft shows its own published theme, then what is below it. The
  stylesheet and the images the page shows are inside the document as `data:`
  addresses, so an image that no public address serves still appears; together
  they may come to 1 MiB, counting an image once for each place it is written, past which the answer is `422`
  (`about:blank#theme-preview-too-large`). The response is meant for a frame
  whose parent is the same origin: its policy allows no script, so a page that
  needs one (`passkey-enrolment`) is rendered without it and the response says
  `X-Odudu-Preview-Script: omitted`. A template that cannot be filled shows the default page, and `X-Odudu-Preview-Fallback` lists the kinds. Through the console it is
  `/console/api/admin/tenants/{tenant}/theme/preview`, which the admin's session
  cookie authorises. An unknown `kind` or `scheme` is `400`. It reads the draft
  and writes nothing.
- `DELETE /theme` deletes the draft and archives the published version, so the
  tenant shows the default and a client shows its tenant's theme. History is kept.

- `POST /theme/assets?kind=logo|darkLogo|favicon|background` uploads an image
  for the tenant's themes (`manage-tenant`, or `manage-clients`, since a client's
  theme names tenant images). The body is the image itself, not
  JSON; a declared type other than `image/png`, `image/jpeg`, `image/webp` or
  `application/octet-stream` is `415`, and none is trusted: the bytes decide.
  The image is decoded and stored re-encoded, so its metadata and anything
  appended are gone, and the answer (`201`) carries the stored `id`, `sha256`,
  `mime`, `width`, `height` and `bytes`. The same picture is one image. The caller,
  the `kind` (`400`) and the declared length (`413`) are checked before any of
  the body is read. Limits: `logo`, `darkLogo` and `favicon` 256 KiB and 1024
  pixels, `background` 1 MiB and 2560 pixels, 8 MiB of stored images a tenant
  (`409`, `about:blank#asset-cap`). Other refusals: `415`
  `asset-unsupported-type`, `422` `asset-animated`, `asset-corrupt`,
  `asset-dimensions`, `asset-timeout`, `413` `asset-too-large`, and `503`
  `asset-busy` with `Retry-After` while the server decodes as many images as it
  will. An uploaded image is not served until a published theme names it.
- `DELETE /theme/assets/{assetId}` (the same two capabilities) answers `204`, or `409`
  (`about:blank#asset-in-use`) while a draft or published theme of the tenant or
  of a client names the image, `errors` listing the first 20 by path and
  version. `404` for an image that does not exist or is another tenant's.
  Uploads and deletes are audited as `theme.asset_uploaded` and
  `theme.asset_deleted`, with ids, hash, kind and size and never the bytes.

A publish, a restore and a reset take effect on the next page this process
renders; another replica shows the previous theme for at most 30 seconds, the
lifetime of its cache. Deleting a client or a tenant drops the cache the same
way. A tenant has no rename, so nothing else changes what a cached theme names.
Each write is audited as `theme.draft_saved`, `theme.published`, `theme.restored`
or `theme.reset`, with ids and versions and never the theme itself.
