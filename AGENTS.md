<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Working on Odudu

`CLAUDE.md` holds the rules for this repository and binds every agent. Read it
in full, then `docs/superpowers/specs/2026-09-10-odudu-design.md`.

**Starting a phase.** Before brainstorming, read what already says what the
phase owns: the roadmap page (`apps/docs/content/en/roadmap.md`, every item
placed on the phase under "Next", "Later" and "Decided against"), the phase's
row in section 11 of the design spec, `docs/NEXT.md` ("What the next phase
inherits" and "Decisions still open") and the notes in `docs/phases/`. Grep
every document for the phase's number and for the phases it replaces. Anything
the roadmap placed on the phase is in scope unless the brainstorm rules it out
in writing.

**A change owns its documentation.** `CLAUDE.md`, "The documentation an
increment owns", is a table: for each kind of change, the pages it updates in
the same commit and the test that checks them, or the words "no check".
