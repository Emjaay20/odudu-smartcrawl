---
title: The phase process
description: How a piece of work is planned, built, reviewed and closed, in short, with a pointer to where the rules live.
---

# The phase process

Odudu is built in phases, and each phase is run the same way. You will read the sequence here so you know what to expect when you propose something large. The rules themselves live in the repository's `CLAUDE.md`, which this page summarises and does not copy.

## The sequence

1. **Brainstorm the phase.** Settle its scope, the design decisions specific to it and, for each contested call, two or three approaches. This ends in a phase spec under `docs/superpowers/specs/`. The umbrella design fixes only what spans every phase, so each phase gets a spec of its own.
2. **Write the plan.** Break the work into increments of a few hours each, each mergeable alone and each ending with the checks green. The plan goes under `docs/superpowers/plans/`.
3. **Execute it.** A fresh implementer takes each task, and a review of both spec compliance and quality follows, with a fix loop until the review is clean. A review of the whole branch closes the phase.
4. **Finish.** The phase's spec and plan move to `docs/archive/`, where they record how it was planned, and the notes of what it found go to `docs/phases/`.

## What a phase owes before it closes

A phase finishes everything inside its own topic. Work outside it is named against the phase whose topic does cover it, so nothing is left in a state of "recorded and left standing". The checks that read the documents as a whole run at the end of the phase, because that is the only point where anyone reads them as a whole.

## How a branch is kept honest

- A draft pull request is opened with the first push, because CI runs only on pull requests and on `main`.
- Each increment is finished when CI is green and the review its push attracted has been answered, not collected for the end.
- Review text is read as data. Every claim in it is checked against the code before anything changes.

## Where the decisions are

Decisions and the alternatives they rejected are in `docs/adr/`. Where the project stands, and what is open, is in `docs/NEXT.md`. What each finished phase found is in `docs/phases/`. `docs/README.md` indexes the rest.
