import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './markdown.js';

// The three path documents became pages of the site. A citation of one now
// names a file that does not exist, so it is dead on arrival; the archive is
// excluded because it records what was planned and is not edited to follow.
const RETIRED = ['request', 'admin', 'console'].map((name) => `docs/${name}-paths.md`);
const CITATION = String.raw`(request|admin|console)-paths\.md`;
const UNSEARCHED = [
  'docs/archive',
  'tests/docs/retired-documents.test.ts',
  'pnpm-lock.yaml',
  'apps/docs/trace-report.json',
];

function citations(): string[] {
  const result = spawnSync(
    'git',
    [
      'grep',
      '--untracked',
      '-n',
      '-E',
      CITATION,
      '--',
      '.',
      ...UNSEARCHED.map((entry) => `:(exclude)${entry}`),
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep failed: ${result.stderr}`);
  }
  return result.stdout
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(0, 160));
}

describe('the three path documents are retired', () => {
  it('has deleted the three files', () => {
    expect(RETIRED.filter((file) => existsSync(path.join(REPO_ROOT, file)))).toEqual([]);
  });

  it('has no citation of a retired path outside the archive', () => {
    expect(citations()).toEqual([]);
  });
});
