# Documentation

Start with [the design specification](superpowers/specs/2026-09-10-odudu-design.md)
(what Odudu is, and every phase with its exit criterion), then
[`NEXT.md`](NEXT.md) for where the project stands.

## What describes the system now

These are kept current, and `tests/docs/` fails the build where the site
drifts from what the server serves.

| Path                                                                                   | What it holds                                                           |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`apps/docs/content/en/`](../apps/docs/content/en/)                                    | The documentation site: guides, concepts, reference, and the roadmap    |
| [`.../reference/transcripts/`](../apps/docs/content/en/reference/transcripts/index.md) | Every protocol, admin API and console request, run against a real stack |
| [`.../roadmap.md`](../apps/docs/content/en/roadmap.md)                                 | What is not implemented, each gap placed in a phase or a decision       |
| [`NEXT.md`](NEXT.md)                                                                   | Where the project stands, what is open, what was deferred               |
| [`adr/`](adr/)                                                                         | Decisions and their rejected alternatives                               |
| [`protocols/`](protocols/)                                                             | One reading note per RFC or specification, clause by clause             |

## What records the past

| Path                               | What it holds                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| [`phases/`](phases/)               | What each finished phase found while it was being built                          |
| [`superpowers/`](superpowers/)     | The umbrella spec, the spike logs, and the specs and plans of a phase still open |
| [`archive/specs/`](archive/specs/) | Specs of finished phases                                                         |
| [`archive/plans/`](archive/plans/) | Plans of finished phases                                                         |

## The archive

An archived spec or plan describes how a phase was planned, not what the
system does now. It names files that were later renamed and migration numbers
that shifted, and it is not edited to follow. For current behaviour read the
documents above; for what a phase learned, read its note in `phases/`.
A phase's spec and plan move to the archive when the phase closes.
