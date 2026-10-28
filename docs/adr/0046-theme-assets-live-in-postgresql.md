# 0046 — Theme images are re-encoded raster files kept in PostgreSQL

**Status:** Accepted · 2026-10-28

## Context

A tenant or client may upload a logo, a favicon and a background for its
pages. An upload is a file chosen by someone who may be hostile: it can declare
a type it is not, carry a script after its last byte or in a metadata tag,
claim dimensions that decode into gigabytes, or be an animation or an SVG,
which can carry script and external references. The server holds up to
10,000 tenants (ADR 0041), so what it stores and decodes has to be bounded.

## Decision

- **Raster only.** PNG, JPEG and WebP. The type is read from the file's leading
  bytes; the declared content type and the filename are never consulted and
  never logged. SVG, GIF, TIFF, HEIF, an APNG (an `acTL` chunk before the first
  `IDAT`) and an animated WebP are refused.
- **Decoded and re-encoded.** `inspectImage` (sharp) reads the header first and refuses a declared size over 16 million
  pixels or a side over the kind's limit before decoding anything, then decodes
  with the same pixel limit, applies the EXIF orientation and encodes again.
  The stored file is the encoder's output, so metadata (EXIF, XMP, ICC, text
  chunks) and any bytes after the image are gone. Refusals are values with
  stable codes; a library error message is never passed on.
- **Limits** (`ASSET_LIMITS`): logo, dark logo and favicon at most 256 KiB and
  1024 px on the longest side, background at most 1 MiB and 2560 px, a tenant at
  most 8 MiB in all. A byte limit applies to the upload, which is refused
  before it is decoded, and again to the re-encoded file.
- **Bounded work.** At most two decodes run at once and sixteen more wait; the
  next is refused as `busy`, so a hundred simultaneous uploads hold two decoded
  images and sixteen request bodies. libvips's operation cache is off.
- **Kept in PostgreSQL**, in `theme_assets` with the bytes in a `bytea` column,
  never selected by a list or a page render, addressed by the SHA-256 of the
  stored bytes with one row per tenant and hash. The tenant cap is checked
  under a per-tenant advisory lock, so two uploads cannot both take the last
  room. Row-level security keeps a tenant's images its own.
- **The store is a seam.** Everything reaches images through `assetRepository`
  (`put`, `get`, `referencedBy`, `delete`, `bytesUsed`); moving the bytes to
  object storage later changes that module and a migration, not the upload, the
  resolver or the console.

## Consequences

- The worst case is 8 MiB for each of 10,000 tenants, about 80 GB, in one table
  with its own TOAST storage. It is backed up and restored with the rest of the
  database and deleted with its tenant by the foreign key, and no deployment
  needs a second system to run a themed server.
- The server depends on a native library. sharp ships prebuilt binaries for
  glibc and musl on x64 and arm64 with no install script, so the image builds
  without a compiler. libvips inside it is LGPL-3.0-or-later, listed in
  `THIRD-PARTY-NOTICES.md`.
- Re-encoding changes the bytes and slightly the pixels of a JPEG or WebP
  (quality 90). A tenant's logo is not byte-identical to what it uploaded.
- A picture uploaded for two slots is one row, and the tenant cap counts it once.

## Alternatives rejected

- **Accept SVG.** A vector logo is what many brands have, but an SVG is a
  document: script, `foreignObject`, external fetches and CSS. Sanitising it is
  a second parser to keep correct on the authorization server's origin, against
  a rasterised image that cannot do any of it. A tenant exports a PNG.
- **Object storage (S3 or a volume) now.** It scales past the cap and keeps
  blobs out of the database, but adds a service, credentials, a consistency
  problem between a row and an object, and a deletion path for tenants. At 8 MiB
  a tenant the database holds all of it. It stays available behind
  `assetRepository` when a deployment's volume asks for it.
- **A CDN in front of the images.** Images are served with a content hash in
  the path and `Cache-Control: public, immutable`, so any CDN or reverse proxy
  already caches them. Odudu does not provide or require one.
- **Validate without re-encoding** (read magic bytes and strip tags). Checking
  can be fooled by what the checker does not parse; re-encoding keeps only what
  the encoder wrote.
- **A pure-JavaScript decoder.** It avoids a native binary, but none handles all
  three formats, and decoding untrusted images in JavaScript is slower and no
  safer than libvips.
