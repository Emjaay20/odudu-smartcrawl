import { describe, expect, it } from 'vitest';
import { classifyChanges } from '#/changes';

const EVERYTHING = { server: true, global: true, buildImage: true, docsOnly: false };

describe('classifyChanges', () => {
  it('runs everything when there is nothing to compare against', () => {
    expect(classifyChanges(undefined)).toEqual(EVERYTHING);
  });

  it('runs everything for an empty list, since a diff that finds nothing is not evidence', () => {
    expect(classifyChanges([])).toEqual(EVERYTHING);
  });

  it('spares the heavy jobs for a change to prose and the docs app only', () => {
    expect(
      classifyChanges([
        'docs/phases/p4g.md',
        'docs/adr/0044-x.md',
        'README.md',
        'apps/docs/content/guides/a.md',
      ]),
    ).toEqual({ server: false, global: false, buildImage: true, docsOnly: true });
  });

  it('does not build the image for prose outside the docs app', () => {
    const result = classifyChanges(['docs/NEXT.md', 'CLAUDE.md']);
    expect(result.docsOnly).toBe(true);
    expect(result.buildImage).toBe(false);
  });

  it('treats the protocol tables as code, because the trace check reads them', () => {
    const result = classifyChanges(['docs/protocols/rfc6749.md']);
    expect(result.server).toBe(true);
    expect(result.docsOnly).toBe(false);
  });

  it('runs the server side for a change in one package, without calling it global', () => {
    expect(classifyChanges(['packages/protocol-oidc/src/a.ts'])).toEqual({
      server: true,
      global: false,
      buildImage: true,
      docsOnly: false,
    });
  });

  it('marks the lockfile, a workflow and a tool as global', () => {
    for (const file of [
      'pnpm-lock.yaml',
      'package.json',
      'turbo.json',
      'vitest.config.ts',
      'tsconfig.base.json',
      'eslint.config.js',
      '.github/workflows/verify.yml',
      '.github/actions/setup/action.yml',
      'tools/ci/src/changes.ts',
      'tests/setup/runtime-warnings.ts',
    ]) {
      expect(classifyChanges([file]), file).toEqual(EVERYTHING);
    }
  });

  it('lets one code file outvote any amount of prose', () => {
    const result = classifyChanges(['docs/NEXT.md', 'apps/docs/nav.ts', 'infra/docker/smoke.sh']);
    expect(result.docsOnly).toBe(false);
    expect(result.server).toBe(true);
  });

  it('does not take a lookalike path for the docs app', () => {
    expect(classifyChanges(['apps/docs-extra/src/a.ts']).server).toBe(true);
    expect(classifyChanges(['packages/x/docs/a.ts']).server).toBe(true);
    expect(classifyChanges(['docs/../packages/x/a.ts']).server).toBe(true);
  });
});
