import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { ExecOptions } from '#/run';

const DEFAULT_TIMEOUT_S = 120;

export interface Session {
  exec(
    command: string,
    env: Record<string, string>,
    options: ExecOptions,
  ): Promise<{ status: number; output: string }>;
  close(): Promise<void>;
}

/**
 * One bash for a whole file, so `cd` and exported variables carry from block
 * to block. A block's standard input is empty, so a command that reads it
 * cannot take the rest of the script. `set -e` ends the shell at the first failing command, which is
 * read as that block's status. The shell leads its own process group so a
 * timeout takes down whatever it started as well.
 */
export function openSession(): Session {
  const marker = `__odudu_docs_run_${randomUUID()}__`;
  const shell = spawn('bash', ['--noprofile', '--norc'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });
  let buffer = '';
  let exited: number | undefined;
  let wake: (() => void) | undefined;
  const closed = new Promise<void>((resolve) => {
    shell.on('close', (code) => {
      exited = code ?? 1;
      wake?.();
      resolve();
    });
  });
  const take = (chunk: Buffer): void => {
    buffer += chunk.toString('utf8');
    wake?.();
  };
  shell.stdout.on('data', take);
  shell.stderr.on('data', take);
  shell.stdin.write('set -e\nexec 2>&1\n');

  const finished = new RegExp(`\\n?${marker} (\\d+)\\n`, 'u');

  const killGroup = (): void => {
    if (shell.pid === undefined) return;
    try {
      process.kill(-shell.pid, 'SIGKILL');
    } catch {
      // the group is already gone
    }
  };

  return {
    async exec(command, env, options) {
      const seconds = options.timeoutSeconds ?? DEFAULT_TIMEOUT_S;
      buffer = '';
      const exports = Object.entries(env)
        .map(([name, value]) => `export ${name}='${value.replaceAll("'", "'\\''")}'\n`)
        .join('');
      shell.stdin.write(
        `${exports}{\n${command}\n} </dev/null\nprintf '\\n%s %d\\n' ${marker} $?\n`,
      );
      const deadline = Date.now() + seconds * 1000;
      for (;;) {
        const done = finished.exec(buffer);
        if (done !== null) {
          const output = buffer.slice(0, done.index).replace(/\n$/u, '');
          return { status: Number(done[1]), output };
        }
        if (exited !== undefined) return { status: exited === 0 ? 1 : exited, output: buffer };
        const left = deadline - Date.now();
        if (left <= 0) {
          killGroup();
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
    async close() {
      shell.stdin.end();
      killGroup();
      await closed;
    },
  };
}
