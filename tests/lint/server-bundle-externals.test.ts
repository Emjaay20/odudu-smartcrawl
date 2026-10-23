import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST = path.join(REPO_ROOT, 'apps/server/dist');

// `@node-rs/argon2` ships a platform-specific native binary per OS/arch;
// bundling it (rather than leaving it as a runtime `require`) makes esbuild
// try to inline whichever binary happens to exist on the machine doing the
// build, which fails on every other platform. This is a build-then-inspect
// test, not a re-implementation of apps/server/tsup.config.ts's
// noExternal/external logic: it runs the real build and checks what tsup
// actually produced, so a config change that "successfully" builds but
// bundles argon2 anyway is still caught.
describe('the server bundle keeps @node-rs/argon2 external', () => {
  it('imports argon2 as a bare specifier and inlines no native binary', async () => {
    execFileSync('pnpm', ['--filter', '@odudu/server', 'build'], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    // main.ts loads each command and the server lazily, so the code is
    // split across chunks beside main.js.
    const files = (await readdir(DIST)).filter((file) => file.endsWith('.js'));
    const bundle = (await Promise.all(files.map((f) => readFile(path.join(DIST, f), 'utf8')))).join(
      '\n',
    );

    expect(bundle).toMatch(/from\s*["']@node-rs\/argon2["']/);
    expect(bundle).not.toMatch(/["'][^"']*\.node["']/);
  }, 60_000);
});
