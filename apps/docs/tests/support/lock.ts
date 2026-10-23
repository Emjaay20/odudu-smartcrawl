import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface LockOptions {
  // A lock older than this is taken over even if its owner looks alive: a
  // build that hangs is killed by its own timeout, which is shorter.
  staleAfterMs: number;
  pollMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ownerIsGone(lock: string): boolean {
  let pid: number;
  try {
    pid = Number(readFileSync(path.join(lock, 'pid'), 'utf8'));
  } catch {
    return false;
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
}

function isStale(lock: string, staleAfterMs: number): boolean {
  try {
    return Date.now() - statSync(lock).mtimeMs > staleAfterMs;
  } catch {
    return false;
  }
}

// The decision that a lock is stale and its removal happen under a second
// lock, so two waiters cannot both judge one lock stale and the later removal
// take a lock the earlier waiter has since acquired.
const GUARD_STALE_MS = 10_000;

function takeOver(lock: string, staleAfterMs: number): void {
  const guard = `${lock}.guard`;
  try {
    mkdirSync(guard);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (isStale(guard, GUARD_STALE_MS)) rmSync(guard, { recursive: true, force: true });
    return;
  }
  try {
    if (ownerIsGone(lock) || isStale(lock, staleAfterMs)) {
      rmSync(lock, { recursive: true, force: true });
    }
  } finally {
    rmSync(guard, { recursive: true, force: true });
  }
}

// A directory is the lock because mkdir is atomic; only "already exists"
// means "held", any other failure is a real one and propagates.
export async function withLock<T>(
  lock: string,
  work: () => T | Promise<T>,
  { staleAfterMs, pollMs }: LockOptions,
): Promise<T> {
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      takeOver(lock, staleAfterMs);
      await sleep(pollMs);
    }
  }
  try {
    writeFileSync(path.join(lock, 'pid'), String(process.pid));
    return await work();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

// Runs the command in its own process group, so a timeout kills what it
// started too, and without blocking the worker while it runs.
export function runWithTimeout(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, detached: true });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      reject(new Error(`${path.basename(command)} timed out after ${String(timeoutMs)} ms`));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} failed:\n${output}`));
    });
  });
}
