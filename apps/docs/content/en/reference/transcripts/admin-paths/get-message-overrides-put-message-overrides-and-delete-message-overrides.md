---
title: 'Message overrides: list, set, remove'
description: 'A tenant’s own wording for the messages its pages show, per language. manage-tenant.'
---

# Message overrides: list, set, remove

This page covers `GET /message-catalogue`, `GET /message-overrides`, `PUT /message-overrides/{locale}/{key}` and `DELETE /message-overrides/{locale}/{key}`.

**No captured output yet.** The routes are built and tested against a real
database, but the stack that captures these pages has not been run with an
override. This page says what the routes do and holds no response that nobody
produced; the captured requests are added when the branding transcripts are.

All four need `manage-tenant`. They change the words a page shows; which
languages a tenant offers, and which one it prefers to the browser's, are the
`supported_locales` and `default_locale` settings (see [GET /settings and PATCH
/settings](./get-settings-and-patch-settings.md)).

- `GET /message-catalogue` lists the messages the pages are filled from, so a
  template's `{{t "key"}}` and an override's `key` can be chosen rather than
  guessed. It answers `sections`, one per package that fills pages, each with the
  `kinds` it fills and its `messages` as `key` and `en`, the English text, in key
  order. A template of a kind may name only a key of its own section; an override
  may name the key of any. It is the same for every tenant, read from the build
  and not the database, a few hundred messages and well under 100 KB, and so
  is never paged. Mail messages are not in it.
- `GET /message-overrides?locale=fr` lists one locale's overrides in key order,
  each with its `locale`, `key`, `message` and `updated_at`. `locale` is
  required and must be a language tag such as `fr` or `zh-Hant-TW`. It pages
  with `limit` (at most 200) and `cursor`, so a tenant's 500 overrides are never
  read at once; a cursor from another locale is refused with `400`.
- `PUT /message-overrides/{locale}/{key}` with `{"message": "…"}` sets the text a
  page shows for the message `key`, such as `login.title`, in `locale`, and
  answers the override. `key` must name a message of a page, else `400` with the
  field `key`; the message is 1 to 2,000 characters, must be valid message
  syntax (an unbalanced brace is a `400` on `message`) and holds no
  bidirectional control characters. It may use the placeholders the English
  catalogue message of the same key uses, and no others: one the page does not
  supply is a `400` on `message` naming it and what the page does supply, since
  the page would otherwise show the catalogue's text with nothing to say why. A
  tenant import is held to the same rule. Markup in it is shown as text, never
  rendered. The
  locale is stored spelled `fr-CA`, whatever was typed.
- A tenant holds at most 500 overrides across every locale. The 501st is
  refused with `409` (`about:blank#message-overrides-full`); changing one that
  exists is always allowed, and two simultaneous writes cannot both take the last
  place.
- `DELETE /message-overrides/{locale}/{key}` answers `204`, or `404` when there is
  none, and the page shows the catalogue's text again.

A tenant may offer a language through overrides alone: its pages then render
with `lang` set to that tag and English text for every key it has not
overridden, since the catalogue holds no other text for it.

A write takes effect on the next page this process renders; another replica shows
the previous text for at most 30 seconds, the lifetime of its cache. Each write
is audited as `message_override.set` or `message_override.delete` with the locale
and key and, for a set, the length of the text and never the text.
