# P4g — Public release: design

**Status:** draft for the owner's review · 2026-10-15
**Phase row:** [section 11 of the umbrella spec](2026-09-10-odudu-design.md), P4g.
That row is the exit criterion and is not restated here. This document
records what the brainstorm added to it, the calls made, and what is left to
the builder.

## Intent

Odudu is complete enough that somebody who has never heard of it should be
able to find it, run it, understand it and deploy it without asking the
people who built it. Today that is impossible: there is no published image,
the only documentation is four long Markdown files, the server's own pages
look unfinished beside the console, and nothing introduces the project.

The first ten minutes decide whether a developer stays. A stranger opens the
landing page, runs one command, and has a working identity provider they can
sign in to from an example application of their own kind (a server-rendered
app, a single-page app, an API, a machine-to-machine client). Everything
after that is the documentation they reach in one hop from the landing page.

**Odudu means "authority" in Ibibio, a language of Akwa Ibom, Nigeria.** The
name, the landing page and the README say so; it is context for what the
product is, an identity provider that holds authority on behalf of the
people who run it.

## Goals

- The exit criterion in section 11 for P4g, unchanged.
- One command takes a stranger from nothing to a signed-in admin console:
  it starts the stack, migrates the database, creates the system tenant and
  its first administrator, and ends by printing the console address and the
  administrator's sign-in. Run in a terminal it asks for the administrator's
  email and password; run without one (a script, a CI job) it takes them from
  environment variables, and when it is given neither it generates a password,
  prints it once and requires it to be changed at first sign-in. The CI job
  that proves the ten-minute claim signs in to the console this way.
- The landing page is the front door: it shows what Odudu is, the one
  command that runs it locally, and a way into the documentation, with
  restrained, smooth motion (CSS transitions and scroll-linked reveals; no
  animation library, nothing that blocks reading).
- The documentation is clean, mobile-first and written in the manner of the
  Vue documentation: a guide path for each reader (a person signing in, an
  administrator, a developer integrating a client, an operator deploying it),
  each with examples that run, and a reference generated from the code.
- The server's sign-in, consent, logout and error pages use the console's
  design system, Instrument, so a person moving from the console to a sign-in
  page sees one product.
- Deploying it yourself is a documented path with a simple, copyable
  starting point.

## Non-goals and anti-goals

- **No hosted service in this phase.** The landing page has a "Hosted
  Odudu" section that says it is planned, with no payment, no sign-up that
  provisions anything, and no price. The hosted service is the paid layer of
  [ADR 0042](../../adr/0042-distribution-licensing-and-the-paid-boundary.md);
  it is not scheduled before P5 and is placed on the roadmap as such.
  Something on the landing page that looks purchasable and is not is a
  failure even if everything else works.
- No per-tenant or per-client branding (P4b). The default is Instrument.
- No translations (ADR 0043 gives P4g the catalogue mechanism in English,
  P4b the first other locale).
- Not a rewrite of the content. The three `*-paths.md` documents migrate;
  their commands stay executed in CI.

## Brand

- The owner chose the **staff** direction from two rounds of sketches: a
  ring on a straight shaft with a short crossbar, a carried sign of
  authority, drawn as single-weight line geometry so it works as a favicon,
  in the terminal and at large sizes.
- The wordmark is lowercase `odudu` in a monospace face; this is a
  proposal, the owner confirms it.
- A designer or the owner finishes the mark; the phase supplies it in SVG at
  the sizes the site, README, favicon and social image need.
- **Not yet cleared.** Geometric marks in identity software overlap easily.
  A trademark and design search is the owner's step before the mark is final.
  Until it is done the release machinery is built and exercised with a
  placeholder mark and pre-release tags (`-rc`) pushed to the registry; the
  first non-pre-release tag and the social image wait for the cleared mark,
  and the phase does not close before they exist.
- Any glyph-like detail must be confirmed by someone who knows the Nsibidi
  tradition before use; nothing is copied from a real sign without that.

## Decisions made while brainstorming

| Decision                           | Call                                                                                                                                                                                                                                                                                                                    | By                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Hosted, paid service               | Not in P4g; landing page says it is planned; placed after P5                                                                                                                                                                                                                                                            | owner                            |
| Brand direction                    | Staff mark; monospace wordmark proposed                                                                                                                                                                                                                                                                                 | owner (mark), builder (wordmark) |
| Landing page and docs are one site | VitePress with a custom home layout, one build, one deploy                                                                                                                                                                                                                                                              | my call                          |
| Where the site is served           | GitHub Pages from the release workflow, on a domain the owner supplies                                                                                                                                                                                                                                                  | my call                          |
| Motion                             | CSS only, respects `prefers-reduced-motion`                                                                                                                                                                                                                                                                             | my call                          |
| Roadmap                            | the hosted service gets an unnumbered placeholder row after P5 in section 11, in the first increment of this phase, so nothing is renumbered                                                                                                                                                                            | my call                          |
| Repository                         | already public; GHCR package visibility, Pages and private vulnerability reporting are switched on by the owner when each increment needs them                                                                                                                                                                          | fact                             |
| Site URL until a domain exists     | the default `github.io` project path; the domain is a one-line change to the VitePress `base` and canonical URL                                                                                                                                                                                                         | my call                          |
| Guide commands in CI               | run against the one-file compose quickstart and the published image, the same job that proves the ten-minute claim                                                                                                                                                                                                      | my call                          |
| Instrument on server pages         | a stylesheet the server serves from its own origin, generated from the console's tokens, with a CSP `style-src 'self'` amendment to ADR 0029; no inline CSS, no remote fonts; the "does Instrument reach every renderer" check sits beside `html-response.test.ts`; the builder decides the details inside those limits | my call                          |

## Left to the builder

The information architecture (section 11 refers to it), the choice of each
example application's framework, the quickstart's exact commands, how the
docs build pulls the OpenAPI document, CLI help and configuration loader
into reference pages, the increment order, and the performance and scale
statement for the site and the image (the server paths this phase touches
are page rendering and message catalogues; the bound is the same as today).

## Open for the owner

- The domain for the site.
- The trademark and design search result, and the finished mark.
- Who confirms any Nsibidi-inspired detail.
