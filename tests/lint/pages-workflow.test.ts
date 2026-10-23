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

function pages(): string {
  const from = RELEASE.indexOf('\n  pages:\n');
  expect(from, 'job pages').toBeGreaterThan(-1);
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

describe('the pages job of the release workflow', () => {
  const block = pages();

  it('is the last job, so nothing after it is read as part of it', () => {
    expect(RELEASE.trimEnd().endsWith(block.trimEnd())).toBe(true);
  });

  it('waits for the image and holds only the permissions it uses', () => {
    expect(block).toMatch(/^ {4}needs: \[prepare, image\]$/mu);
    expect(granted(block)).toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' });
  });

  it('deploys through the github-pages environment', () => {
    expect(block).toMatch(/^ {4}environment:\n {6}name: github-pages\n/mu);
    expect(block).toContain('url: ${{ steps.deployment.outputs.page_url }}');
  });

  it('runs for a stable tag, and for a run by hand that asks for the site', () => {
    const condition = /^ {4}if: >-\n((?: {6}.+\n)+)/mu.exec(block)?.[1] ?? '';
    expect(condition).toContain("github.event_name == 'push'");
    expect(condition).toContain("needs.prepare.outputs.prerelease == 'false'");
    expect(condition).toContain("github.event_name == 'workflow_dispatch' && inputs.deploy_site");
  });

  it('offers deploy_site as a boolean that is off unless asked for', () => {
    expect(RELEASE).toMatch(
      /^ {6}deploy_site:\n {8}description: .+\n {8}type: boolean\n {8}default: false$/mu,
    );
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
    expect(block).not.toMatch(/DOCS_BASE|DOCS_SITE_ORIGIN|github\.io/u);
  });

  it('keeps no credential in its checkout, and runs no local action', () => {
    expect(block).toMatch(
      /actions\/checkout@\S+[^\n]*\n {8}with:\n {10}persist-credentials: false\n/u,
    );
    expect(block).not.toMatch(/uses: \.\//u);
  });

  it('has a timeout', () => {
    expect(block).toMatch(/^ {4}timeout-minutes: \d+$/mu);
  });

  it('never names the site in the workflow', () => {
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
