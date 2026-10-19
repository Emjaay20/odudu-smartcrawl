import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const CLI = join(import.meta.dirname, 'index.ts');
let dir: string | undefined;

afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd });
}

function repoWithChange(changed: string): string {
  dir = mkdtempSync(join(tmpdir(), 'odudu-ci-changes-'));
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'README.md'), 'a');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feature');
  mkdirSync(dirname(join(dir, changed)), { recursive: true });
  writeFileSync(join(dir, changed), 'b');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'change');
  return dir;
}

function run(cwd: string, ...args: string[]): string {
  return execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

describe('the changes command', () => {
  it('reports a docs-only branch as docs-only', () => {
    const out = run(repoWithChange('docs/NEXT.md'), 'changes', 'main');
    expect(out).toContain('docsOnly=true');
    expect(out).toContain('server=false');
  });

  it('reports a workflow change as global', () => {
    const out = run(repoWithChange('.github/workflows/verify.yml'), 'changes', 'main');
    expect(out).toContain('global=true');
    expect(out).toContain('docsOnly=false');
  });

  it('runs everything when the base cannot be resolved', () => {
    const out = run(repoWithChange('docs/NEXT.md'), 'changes', 'no-such-ref');
    expect(out).toContain('server=true');
  });

  it('runs everything without a base, as on a push to main', () => {
    expect(run(repoWithChange('docs/NEXT.md'), 'changes')).toContain('server=true');
  });

  it('writes the same lines to the file GITHUB_OUTPUT names', () => {
    const cwd = repoWithChange('packages/a/src/a.ts');
    const file = join(cwd, 'out.txt');
    execFileSync(process.execPath, [CLI, 'changes', 'main'], {
      cwd,
      env: { ...process.env, GITHUB_OUTPUT: file },
    });
    const written = execFileSync('cat', [file], { encoding: 'utf8' });
    expect(written).toContain('server=true');
    expect(written).toContain('global=false');
  });
});
