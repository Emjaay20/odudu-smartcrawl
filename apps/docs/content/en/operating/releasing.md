---
title: Releasing
description: How a version of Odudu is published, for the people who publish one.
---

# Releasing

This page is for the people who publish Odudu, not for people who run it. If you only run it, you want [Deploying](./deploying.md) and [Upgrading](./upgrading.md).

A release is a tag. Pushing `v0.1.0` starts a workflow that builds the image for `linux/amd64` and `linux/arm64`, pushes it with its contents list and build record, signs it, and publishes a GitHub Release with that version's `compose.yaml`. A tag ending `-rc.1` makes a release candidate: it gets its own image tag and a pre-release, and never `latest`.

The steps are in [RELEASING.md](https://github.com/wizzywit/odudu/blob/main/RELEASING.md): write the changelog, wait for CI on the commit, tag it, push the tag and verify the image. It also says how to yank a release and what only the repository's owner can do.

Odudu is before 1.0, so a minor version may break something. The changelog says what changed in each version.
