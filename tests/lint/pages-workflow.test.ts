import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Reads the workflow files as text. Not seen: whether GitHub accepts the
// workflow, whether Pages is enabled in the repository settings, and whether a
// deploy succeeds; the first stable tag, or the first run by hand, shows those.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const RELEASE = readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8');
const LINKS = readFileSync(path.join(REPO_ROOT, '.github/workflows/links.yml'), 'utf8');
const PINNED = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)?@[0-9a-f]{40}$/u;

const PAGES = readFileSync(path.join(REPO_ROOT, '.github/workflows/pages.yml'), 'utf8');

function site(): string {
  const from = RELEASE.indexOf('\n  site:\n');
  expect(from, 'job site').toBeGreaterThan(-1);
  return RELEASE.slice(from + 1);
}

function granted(block: string): Record<string, string> {
  const body = /^ {4}permissions:\n((?: {6}[\w-]+: \w+\n)+)/mu.exec(block)?.[1] ?? '';
  const found: Record<string, string> = {};
  for (const [, scope = '', level = ''] of body.matchAll(/^ {6}([\w-]+): (\w+)$/gmu)) {
    found[scope] = level;
  }
  return found;
}

describe('the pages workflow', () => {
  const block = PAGES.slice(PAGES.indexOf('\n  pages:\n') + 1);

  it('runs by hand and when called, takes no input, and holds nothing by default', () => {
    const on = /^on:\n([\s\S]*?)\n\npermissions:/mu.exec(PAGES)?.[1] ?? '';
    expect(on).toContain('workflow_dispatch:');
    expect(on).toContain('workflow_call:');
    expect(on).not.toMatch(/inputs:|push:|pull_request|schedule:/u);
    expect(PAGES).toMatch(/^permissions: \{\}$/mu);
  });

  it('needs nothing and holds only the permissions it uses', () => {
    expect(block).not.toMatch(/^ {4}needs:/mu);
    expect(granted(block)).toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' });
  });

  it('deploys through the github-pages environment', () => {
    expect(block).toMatch(/^ {4}environment:\n {6}name: github-pages\n/mu);
    expect(block).toContain('url: ${{ steps.deployment.outputs.page_url }}');
  });

  it('uses the three Pages actions, each pinned to a commit', () => {
    for (const name of ['configure-pages', 'upload-pages-artifact', 'deploy-pages']) {
      const line = new RegExp(`uses: (actions/${name}@\\S+) # v\\d+\\.\\d+\\.\\d+$`, 'mu');
      const action = line.exec(block)?.[1] ?? '';
      expect(action, name).toMatch(PINNED);
    }
  });

  it('builds with the package script and gives it neither an address nor a base', () => {
    expect(block).toContain('pnpm --filter @odudu/docs build:pages');
    expect(block).toContain('path: apps/docs/dist/pages');
    expect(PAGES).not.toMatch(/DOCS_BASE|DOCS_SITE_ORIGIN|github\.io/u);
  });

  it('keeps no credential in its checkout, and runs no local action', () => {
    expect(block).toMatch(
      /actions\/checkout@\S+[^\n]*\n {8}with:\n {10}persist-credentials: false\n/u,
    );
    expect(block).not.toMatch(/uses: \.\//u);
  });

  it('has a timeout, and serialises deploys without cancelling one', () => {
    expect(block).toMatch(/^ {4}timeout-minutes: \d+$/mu);
    expect(PAGES).toMatch(/^concurrency:\n {2}group: pages\n {2}cancel-in-progress: false$/mu);
  });
});

describe('the site job of the release workflow', () => {
  const block = site();

  it('is the last job, so nothing after it is read as part of it', () => {
    expect(RELEASE.trimEnd().endsWith(block.trimEnd())).toBe(true);
  });

  it('calls the pages workflow only after the release exists, and never for a candidate', () => {
    expect(block).toMatch(/^ {4}needs: \[prepare, release\]$/mu);
    expect(block).toMatch(
      /^ {4}if: needs\.prepare\.outputs\.prerelease == 'false' && needs\.prepare\.outputs\.latest == 'true'$/mu,
    );
    expect(block).toMatch(/^ {4}uses: \.\/\.github\/workflows\/pages\.yml$/mu);
  });

  it('grants the called workflow exactly what it asks for', () => {
    expect(granted(block)).toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' });
  });

  it('adds no input to the release workflow, and never names the site', () => {
    expect(RELEASE).not.toContain('deploy_site');
    expect(RELEASE).not.toContain('wizzywit.github.io');
  });
});

describe('the weekly external link check', () => {
  it('runs on a schedule and by hand, never on a pull request, and holds read access only', () => {
    const on = /^on:\n([\s\S]*?)\n\npermissions:/mu.exec(LINKS)?.[1] ?? '';
    expect(on).toMatch(/^ {2}schedule:\n {4}- cron: '[\d*/ ,-]+'$/mu);
    expect(on).toContain('workflow_dispatch:');
    expect(on).not.toMatch(/pull_request|push:/u);
    expect(LINKS).toMatch(/^permissions:\n {2}contents: read$/mu);
    expect(LINKS).not.toMatch(/issues: write|pull-requests: write/u);
  });

  it('pins every action to a commit and names the version beside it', () => {
    const uses = [...LINKS.matchAll(/^\s+(?:- )?uses: (\S+)(.*)$/gmu)];
    expect(uses.length).toBeGreaterThan(1);
    for (const [, action = '', rest = ''] of uses) {
      expect(action, action).toMatch(PINNED);
      expect(rest.trim(), action).toMatch(/^# v\d+\.\d+\.\d+$/u);
    }
  });

  it('uses lychee, fails the run on a broken link, and takes a rate limit as a pass', () => {
    expect(LINKS).toContain('lycheeverse/lychee-action@');
    expect(LINKS).toMatch(/fail: true/u);
    expect(LINKS).toMatch(/--accept '[^']*\b429\b[^']*'/u);
    expect(LINKS).toMatch(/--exclude '\^https\?:\/\/localhost/u);
  });

  it('is no part of the gate', () => {
    const verify = readFileSync(path.join(REPO_ROOT, '.github/workflows/verify.yml'), 'utf8');
    expect(verify).not.toContain('links.yml');
    expect(verify).not.toMatch(/lychee/u);
  });
});
