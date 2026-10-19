import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const LOCK = path.join(tmpdir(), 'odudu-docs-build.lock');
const STALE_AFTER_MS = 5 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Every docusaurus build writes the app's `.docusaurus` directory, so builds
// started by different test files take turns.
async function acquire(): Promise<void> {
  const deadline = Date.now() + STALE_AFTER_MS;
  for (;;) {
    try {
      mkdirSync(LOCK);
      return;
    } catch {
      if (Date.now() > deadline) {
        rmSync(LOCK, { recursive: true, force: true });
      } else {
        await sleep(250);
      }
    }
  }
}

export async function buildSite(out: string, env: Record<string, string>): Promise<void> {
  await acquire();
  try {
    const build = spawnSync(
      path.join(DOCS_ROOT, 'node_modules/.bin/docusaurus'),
      ['build', '--out-dir', out],
      { cwd: DOCS_ROOT, env: { ...process.env, DOCS_TARGET: '', ...env }, encoding: 'utf8' },
    );
    if (build.status !== 0) throw new Error(`build failed:\n${build.stdout}\n${build.stderr}`);
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}
