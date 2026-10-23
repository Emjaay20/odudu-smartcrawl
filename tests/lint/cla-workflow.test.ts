import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

async function read(file: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, file), 'utf8');
}

const WORKFLOW = await read('.github/workflows/cla.yml');
const CLA = (await read('CLA.md')).replace(/[ \t]*\n(?!\n)/gu, ' ');
const CONTRIBUTING = await read('CONTRIBUTING.md');
const SIGN_PHRASE = 'I have read the CLA Document and I hereby sign the CLA';

describe('the CLA workflow', () => {
  it('runs on pull_request_target and on a created comment, and on nothing else', () => {
    const on = /^on:\n([\s\S]*?)\n\npermissions:/mu.exec(WORKFLOW)?.[1] ?? '';
    expect(on).toMatch(/pull_request_target:\n\s+types: \[opened, synchronize, closed\]/u);
    expect(on).toMatch(/issue_comment:\n\s+types: \[created\]/u);
    expect(on).not.toMatch(/^ {2}(push|pull_request|schedule|workflow_run|workflow_dispatch):/mu);
  });

  it('checks out nothing: a pull_request_target job holds write access', () => {
    expect(WORKFLOW).not.toMatch(/actions\/checkout/u);
    expect(WORKFLOW).not.toMatch(/^\s*- uses: \.\//mu);
    expect(WORKFLOW).not.toMatch(/\brun:/u);
  });

  it('grants nothing by default and the job exactly what the action writes', () => {
    expect(WORKFLOW).toMatch(/^permissions: \{\}$/mu);
    const body = /^ {4}permissions:\n((?: {6}[\w-]+: \w+\n)+)/mu.exec(WORKFLOW)?.[1] ?? '';
    const granted: Record<string, string> = {};
    for (const [, scope = '', level = ''] of body.matchAll(/^ {6}([\w-]+): (\w+)$/gmu)) {
      granted[scope] = level;
    }
    expect(granted).toEqual({
      actions: 'write',
      contents: 'write',
      'pull-requests': 'write',
      statuses: 'write',
    });
  });

  it('names the job cla, the check Owner step 4 requires', () => {
    expect(WORKFLOW).toMatch(/^jobs:\n {2}cla:\n/mu);
    expect(WORKFLOW).toMatch(/^ {4}name: cla$/mu);
  });

  it('runs only for a pull request event or the signing and recheck comments', () => {
    expect(WORKFLOW).toContain("github.event.comment.body == 'recheck'");
    expect(WORKFLOW).toContain(`github.event.comment.body == '${SIGN_PHRASE}'`);
    expect(WORKFLOW).toContain("github.event_name == 'pull_request_target'");
  });

  it('pins the action by full commit SHA, with its release in a comment', () => {
    expect(WORKFLOW).toMatch(
      /uses: contributor-assistant\/github-action@[0-9a-f]{40} # v2\.6\.1$/mu,
    );
    expect(WORKFLOW).not.toMatch(/TODO\(owner\)/u);
  });

  it('reads CLA.md from main and keeps signatures on their own branch', () => {
    expect(WORKFLOW).toContain(
      'path-to-document: https://github.com/wizzywit/odudu/blob/main/CLA.md',
    );
    expect(WORKFLOW).toContain('branch: cla-signatures');
    expect(WORKFLOW).toContain('path-to-signatures: signatures/cla.json');
  });

  it('exempts the owner and Dependabot, and nobody else', () => {
    expect(WORKFLOW).toMatch(/^ {10}allowlist: wizzywit,dependabot\[bot\]$/mu);
  });

  it('uses the default token, never a stored secret', () => {
    expect(WORKFLOW).toContain('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}');
    expect(WORKFLOW).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/u);
  });
});

describe('the CLA text and where it is linked', () => {
  it('marks itself a draft until it is approved', () => {
    expect(CLA).toMatch(/> DRAFT: not legal advice/u);
  });

  it('grants a copyright licence and a patent licence', () => {
    expect(CLA).toMatch(/## Copyright licence/u);
    expect(CLA).toMatch(/## Patent licence/u);
    expect(CLA).toMatch(
      /perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable/u,
    );
  });

  it('lets the owner offer contributions under other licences, a commercial one included', () => {
    expect(CLA).toMatch(/## Other licences/u);
    expect(CLA).toMatch(/commercial licence/u);
    expect(CLA).toMatch(/hosted/u);
  });

  it('has the signing sentence the action matches, and no obligation to use a contribution', () => {
    expect(CLA).toContain(SIGN_PHRASE);
    expect(CLA).toMatch(/not obliged to use/u);
  });

  it('is linked from CONTRIBUTING.md, which says how to sign', () => {
    expect(CONTRIBUTING).toMatch(/\]\(CLA\.md\)/u);
    expect(CONTRIBUTING).toContain(SIGN_PHRASE);
    expect(CONTRIBUTING).not.toMatch(/not published yet/u);
  });

  it('is named by the workflow as the document it enforces', () => {
    expect(WORKFLOW).toContain('CLA.md');
  });
});
