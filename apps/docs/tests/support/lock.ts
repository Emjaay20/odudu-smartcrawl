import { spawnSync } from 'node:child_process';
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
      if (ownerIsGone(lock) || isStale(lock, staleAfterMs)) {
        rmSync(lock, { recursive: true, force: true });
      } else {
        await sleep(pollMs);
      }
    }
  }
  try {
    writeFileSync(path.join(lock, 'pid'), String(process.pid));
    return await work();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function runWithTimeout(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  timeoutMs: number,
): void {
  const run = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });
  if (run.error !== undefined && 'code' in run.error && run.error.code === 'ETIMEDOUT') {
    throw new Error(`${path.basename(command)} timed out after ${String(timeoutMs)} ms`);
  }
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0) {
    throw new Error(`${path.basename(command)} failed:\n${run.stdout}\n${run.stderr}`);
  }
}
