import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../docs/markdown.js';

// The shim is what `docker compose exec odudu odudu seed ...` runs. In the
// quickstart stack the server's configuration is a file in the state volume,
// not the container's environment, so the shim has to read it.

const scratch = mkdtempSync(path.join(tmpdir(), 'odudu-shim-'));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

writeFileSync(path.join(scratch, 'node'), '#!/bin/sh\nprintf "%s\\n" "$NODE_NO_WARNINGS" "$@"\n');
chmodSync(path.join(scratch, 'node'), 0o755);
const shim = path.join(REPO_ROOT, 'infra/docker/odudu');

function run(envFile: string): string[] {
  // The first line is what the command saw in NODE_NO_WARNINGS.
  const result = spawnSync('sh', [shim, 'seed', 'tenant'], {
    env: { PATH: `${scratch}:/usr/bin:/bin`, ODUDU_QUICKSTART_ENV_FILE: envFile },
    encoding: 'utf8',
  });
  return result.stdout.replace(/\n$/u, '').split('\n').slice(1);
}

describe('the odudu command shim', () => {
  it('loads quickstart.env when the state volume holds one', () => {
    const file = path.join(scratch, 'quickstart.env');
    writeFileSync(file, 'ODUDU_KEK=x\n');
    expect(run(file)).toEqual([`--env-file=${file}`, '/app/dist/main.js', 'seed', 'tenant']);
  });

  it('passes the arguments through untouched when there is none', () => {
    expect(run(path.join(scratch, 'absent.env'))).toEqual(['/app/dist/main.js', 'seed', 'tenant']);
  });
});

describe('the command shim output', () => {
  it('keeps experimental-API warnings out of a command the reader copies from', () => {
    const result = spawnSync('sh', [shim], {
      env: { PATH: `${scratch}:/usr/bin:/bin`, ODUDU_QUICKSTART_ENV_FILE: '/nonexistent' },
      encoding: 'utf8',
    });
    expect(result.stdout.split('\n')[0]).toBe('1');
  });
});
