import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';
import { runWithTimeout, withLock } from '#docs/tests/support/lock.ts';

// One lock per checkout: a second worktree builds into its own directory.
const LOCK = path.join(
  tmpdir(),
  `odudu-docs-build-${createHash('sha1').update(DOCS_ROOT).digest('hex').slice(0, 12)}.lock`,
);
const BUILD_TIMEOUT_MS = 120_000;
// Shorter than the longest hook that waits on it, longer than one build.
const STALE_AFTER_MS = 150_000;

// Every docusaurus build writes the app's `.docusaurus` directory, so builds
// started by different test files take turns.
export async function buildSite(out: string, env: Record<string, string>): Promise<void> {
  await withLock(
    LOCK,
    () => {
      runWithTimeout(
        path.join(DOCS_ROOT, 'node_modules/.bin/docusaurus'),
        ['build', '--out-dir', out],
        { cwd: DOCS_ROOT, env: { ...process.env, DOCS_TARGET: '', ...env } },
        BUILD_TIMEOUT_MS,
      );
    },
    { staleAfterMs: STALE_AFTER_MS, pollMs: 250 },
  );
}
