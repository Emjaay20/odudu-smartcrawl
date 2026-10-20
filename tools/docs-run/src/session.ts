import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { TIMEOUT_ENV } from '#/parse';

const DEFAULT_TIMEOUT_S = 120;

export interface Session {
  exec(command: string, env: Record<string, string>): Promise<{ status: number; output: string }>;
  close(): void;
}

/**
 * One bash for a whole file, so `cd` and exported variables carry from block
 * to block. `set -e` ends the shell at the first failing command, which is
 * read as that block's status.
 */
export function openSession(): Session {
  const marker = `__odudu_docs_run_${randomUUID()}__`;
  const shell = spawn('bash', ['--noprofile', '--norc'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  let exited: number | undefined;
  let wake: (() => void) | undefined;
  const changed = (): void => {
    wake?.();
  };
  const take = (chunk: Buffer): void => {
    buffer += chunk.toString('utf8');
    changed();
  };
  shell.stdout.on('data', take);
  shell.stderr.on('data', take);
  shell.on('close', (code) => {
    exited = code ?? 1;
    changed();
  });
  shell.stdin.write('set -e\nexec 2>&1\n');

  const finished = new RegExp(`\\n?${marker} (\\d+)\\n`, 'u');

  return {
    async exec(command, env) {
      const seconds = Number(env[TIMEOUT_ENV] ?? DEFAULT_TIMEOUT_S);
      buffer = '';
      shell.stdin.write(`${command}\nprintf '\\n%s %d\\n' ${marker} $?\n`);
      const deadline = Date.now() + seconds * 1000;
      for (;;) {
        const done = finished.exec(buffer);
        if (done !== null) {
          const output = buffer.slice(0, done.index);
          return { status: Number(done[1]), output };
        }
        if (exited !== undefined) return { status: exited === 0 ? 1 : exited, output: buffer };
        const left = deadline - Date.now();
        if (left <= 0) {
          shell.kill('SIGKILL');
          return { status: 124, output: `${buffer}\ntimed out after ${String(seconds)}s` };
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, left);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
    },
    close() {
      shell.stdin.end();
      shell.kill();
    },
  };
}
