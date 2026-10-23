import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';
import { runWithTimeout, withLock } from '#docs/tests/support/lock.ts';

// One lock per checkout: a second worktree builds into its own directory.
const LOCK = path.join(
  tmpdir(),
  `odudu-docs-build-${createHash('sha1').update(DOCS_ROOT).digest('hex').slice(0, 12)}.lock`,
);
// Generous: a timeout here is a hang, which the CI step's own limit reports.
const BUILD_TIMEOUT_MS = 300_000;
// Longer than the build timeout, so a lock is stale only if its owner died.
const STALE_AFTER_MS = 330_000;

// A build after one for another target would reuse the first's base in what
// it caches, so each starts without them. `docusaurus clear` would also remove
// the fixture trees a test keeps under the same cache directory.
export function clearBuildCaches(root: string): void {
  for (const dir of ['.docusaurus', 'node_modules/.cache/rspack']) {
    rmSync(path.join(root, dir), { recursive: true, force: true });
  }
}

// Every docusaurus build writes the app's `.docusaurus` directory, so builds
// started by different test files take turns.
export async function buildSite(out: string, env: Record<string, string>): Promise<void> {
  await withLock(
    LOCK,
    () => {
      clearBuildCaches(DOCS_ROOT);
      return runWithTimeout(
        path.join(DOCS_ROOT, 'node_modules/.bin/docusaurus'),
        ['build', '--out-dir', out],
        { cwd: DOCS_ROOT, env: { ...process.env, DOCS_TARGET: '', ...env } },
        BUILD_TIMEOUT_MS,
      );
    },
    { staleAfterMs: STALE_AFTER_MS, pollMs: 250 },
  );
}
