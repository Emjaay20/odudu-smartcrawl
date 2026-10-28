---
title: 'GET /mail/preview and GET /mail/branding'
description: 'The verification mail as a tenant’s published theme dresses it, and the logo and colours it inherits. manage-tenant.'
---

# `GET /mail/preview` and `GET /mail/branding`

Both need `manage-tenant` and answer for the tenant in the path only.

**No captured output yet.** Both routes are built and tested against a real
database, but the stack that
captures these pages has not been run with a published theme, so this page says
what the routes do and holds no response that nobody produced. The captured
requests are added when the branding transcripts are.

- `GET /mail/preview?kind=&scheme=&locale=` answers the address-verification
  mail as an HTML document, built by the code that builds the real one, with a
  sample address and link. It shows the tenant's published theme, never a draft,
  and a tenant with none shows the default. `kind` is `verify-email`, which is
  also what a missing one means; `scheme` is `light` (also when left out) or
  `dark` and fixes the palette and logo a mail client would otherwise choose by
  its own setting; `locale` is `en` or `ar`, else the tenant's `default_locale`,
  else English. The default mark is carried as a `data:` address. The response
  is meant for a frame whose parent is the same origin: its policy allows no
  script and images only from the logo's origin, and `no-store` keeps it out of
  caches. An unknown `kind`, `scheme` or `locale` is `400`. Nothing is queued,
  saved or sent.
- `GET /mail/branding` answers what that mail inherits: for `light` and `dark`
  the nine colours (`page`, `panel`, `sunken`, `border`, `ink`, `muted`, `link`,
  `button`, `button_ink`) with a `source` of `tenant` when the published theme
  sets that scheme and `default` when Odudu's own colours are used, and the
  `logo` and `dark_logo` as `src`, `alt`, `width` and `height`, or `null`. A mail
  uses the tenant's theme only, never a client's.
