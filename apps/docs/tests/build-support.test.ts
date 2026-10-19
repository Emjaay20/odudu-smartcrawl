import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync } from 'node:fs';
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

  it('does not treat a failure other than "already held" as a held lock', async () => {
    const lock = path.join(lockPath(), 'missing-parent', 'build.lock');
    await expect(withLock(lock, () => 'done', FAST)).rejects.toThrow(/ENOENT/u);
  });
});

describe('runWithTimeout', () => {
  it('fails with the time it was given when the command hangs', () => {
    expect(() => {
      runWithTimeout(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {}, 300);
    }).toThrow(/timed out after 300 ms/u);
  });

  it('returns when the command succeeds and names the output when it fails', () => {
    expect(() => {
      runWithTimeout(process.execPath, ['-e', ''], {}, 5_000);
    }).not.toThrow();
    expect(() => {
      runWithTimeout(process.execPath, ['-e', 'console.error("why"); process.exit(3)'], {}, 5_000);
    }).toThrow(/why/u);
  });
});
