import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';
import { loadDocument, REPO_ROOT } from './markdown.js';

// CLAUDE.md's list of what a change must update names the test that checks
// each row. A test renamed or deleted leaves a row promising a check that no
// longer runs, so every test the list names has to exist.
const HEADING = '### The documentation an increment owns';

function namedTests(): string[] {
  const { lines } = loadDocument('CLAUDE.md');
  const start = lines.indexOf(HEADING);
  if (start === -1) throw new Error(`CLAUDE.md has no ${HEADING}`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('### '));
  const table = lines.slice(start, end === -1 ? undefined : end);
  return table.flatMap((row) => [...row.matchAll(/`([^`]+\.test\.ts)`/gu)].map((m) => m[1] ?? ''));
}

function trackedTests(): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '*.test.ts'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter((file) => file !== '');
}

it('names, in the documentation list, only tests that exist', () => {
  const named = namedTests();
  expect(named.length).toBeGreaterThan(15);
  const files = trackedTests();
  const missing = named.filter((name) =>
    name.includes('/')
      ? !files.includes(name)
      : !files.some((file) => path.basename(file) === name),
  );
  expect(missing).toEqual([]);
});
