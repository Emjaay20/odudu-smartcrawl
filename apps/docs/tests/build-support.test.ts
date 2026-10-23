import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runWithTimeout, withLock } from '#docs/tests/support/lock.ts';

let dir = '';

function lockPath(): string {
  dir = mkdtempSync(path.join(tmpdir(), 'odudu-docs-lock-'));
  return path.join(dir, 'build.lock');
}

function heldBy(lock: string, pid: number): void {
  mkdirSync(lock);
  writeFileSync(path.join(lock, 'pid'), String(pid));
}

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const FAST = { staleAfterMs: 5_000, pollMs: 10 };

describe('withLock', () => {
  it('releases the lock when the work throws', async () => {
    const lock = lockPath();
    await expect(
      withLock(
        lock,
        () => {
          throw new Error('boom');
        },
        FAST,
      ),
    ).rejects.toThrow('boom');
    expect(existsSync(lock)).toBe(false);
  });

  it('takes over a lock whose owner is gone', async () => {
    const lock = lockPath();
    heldBy(lock, 2 ** 22 + 12345);
    expect(await withLock(lock, () => 'done', FAST)).toBe('done');
  });

  it('takes over a lock older than the deadline even if its owner is alive', async () => {
    const lock = lockPath();
    heldBy(lock, process.pid);
    const old = new Date(Date.now() - 60_000);
    utimesSync(lock, old, old);
    expect(await withLock(lock, () => 'done', { staleAfterMs: 1_000, pollMs: 10 })).toBe('done');
  });

  it('waits for a live owner, then takes the lock when it is released', async () => {
    const lock = lockPath();
    heldBy(lock, process.pid);
    setTimeout(() => {
      rmSync(lock, { recursive: true, force: true });
    }, 100);
    expect(await withLock(lock, () => 'done', FAST)).toBe('done');
  });

  it('lets one of many waiters on a dead owner lock work at a time', async () => {
    const lock = lockPath();
    heldBy(lock, 2 ** 22 + 777);
    let running = 0;
    let peak = 0;
    const work = async (): Promise<void> => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 15));
      running -= 1;
    };
    await Promise.all(Array.from({ length: 25 }, () => withLock(lock, work, FAST)));
    expect(peak).toBe(1);
  });

  it('does not treat a failure other than "already held" as a held lock', async () => {
    const lock = path.join(lockPath(), 'missing-parent', 'build.lock');
    await expect(withLock(lock, () => 'done', FAST)).rejects.toThrow(/ENOENT/u);
  });
});

describe('runWithTimeout', () => {
  it('fails with the time it was given when the command hangs', async () => {
    await expect(
      runWithTimeout(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {}, 300),
    ).rejects.toThrow(/timed out after 300 ms/u);
  });

  it('kills what the command started as well', async () => {
    lockPath();
    const pidFile = path.join(dir, 'grandchild.pid');
    const script = `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
      setInterval(() => {}, 1000);`;
    await expect(runWithTimeout(process.execPath, ['-e', script], {}, 1_000)).rejects.toThrow(
      /timed out/u,
    );
    const pid = Number(readFileSync(pidFile, 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(() => process.kill(pid, 0)).toThrow(/ESRCH/u);
  });

  it('returns when the command succeeds and names the output when it fails', async () => {
    await runWithTimeout(process.execPath, ['-e', ''], {}, 5_000);
    await expect(
      runWithTimeout(process.execPath, ['-e', 'console.error("why"); process.exit(3)'], {}, 5_000),
    ).rejects.toThrow(/why/u);
  });
});
