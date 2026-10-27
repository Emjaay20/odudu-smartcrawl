# 0045 — A page template is HTML with slots; the server owns every part that does something

**Status:** Accepted · 2026-10-27

## Context

A tenant or client may replace the markup of the pages the sign-in flow shows.
A page carries a form, hidden fields, a CSRF value, a nonce'd script on one
page and the wording of a locale, and a template written by a tenant must not
be able to remove, duplicate or forge any of them, nor to run script on the
authorization server's origin.

## Decision

A template is HTML with two kinds of slot and no other syntax: `{{part.name}}`
and `{{t "catalogue.key"}}`. Each page kind declares a manifest of parts
(`PAGE_KINDS` in `@odudu/kernel`): the form's open and close tags, the fields,
the submit, errors, links, and `script` where the page needs one. The server
builds every part; the template only places them. Catalogue text is escaped
on insertion and parts are inserted as built.

`checkTemplate` runs when a draft is saved and again at publish. It parses with
parse5 and accepts only what it recognises: an allowlist of elements, of
attributes (`class`, `lang`, `dir`, `role`, `aria-*`, an https `a href` with
`rel="noopener noreferrer"`, an `img src` that is one of the theme's assets
with `alt`), each required part exactly once, no unknown slot, no slot in an
attribute, comment or raw-text element, no comment, and bounds on size
(64 KiB) and slot count (200). The source is what is filled, so a tag the
parser would drop in context is refused by name too. A template that fails
any check at render time falls back to the layer below.

## Consequences

- A theme cannot reach a form, a field or a script, so it cannot exfiltrate a
  password or drop the CSRF value; the manifest check makes a template that
  loses the form fail at save rather than render a page nobody can submit.
- A new element or attribute is a change to the allowlist, never a default.
- Layout control is real (any arrangement of the parts) but there is no
  conditional or repeated markup; a part that varies by step (`fields`) is one
  slot.

## Alternatives rejected

- **A structured theme** (fixed layouts, a few knobs): the safest and the
  simplest to check, and too little control for a tenant that wants its own
  page. Rejected.
- **A logic template language** (Liquid-style conditionals and loops):
  decided against for now. It needs a sandboxed engine with execution limits
  and a larger attack surface, for control nobody has asked for. Slot
  templates grow into it without redoing the sanitiser or the required-parts
  check, because those run on the filled-in structure either way. Revisit
  when a user asks for it.
