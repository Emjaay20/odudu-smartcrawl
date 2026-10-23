import { describe, expect, it } from 'vitest';
import type { RunnableBlock } from '#/parse';
import { runBlocks } from '#/run';

const block = (over: Partial<RunnableBlock> & { command: string }): RunnableBlock => ({
  file: 'g.md',
  line: 1,
  expect: [],
  env: {},
  ...over,
});

type Exec = (
  command: string,
  env: Record<string, string>,
  options: { timeoutSeconds?: number },
) => Promise<{ status: number; output: string }>;

describe('runBlocks', () => {
  it('hands the runner each block command verbatim, in document order', async () => {
    const seen: string[] = [];
    const exec: Exec = (command) => {
      seen.push(command);
      return Promise.resolve({ status: 0, output: '' });
    };
    const commands = ['echo  "a"  ', 'cd /tmp', "printf '%s' x"];
    await runBlocks(
      commands.map((command, i) => block({ command, line: i + 1 })),
      exec,
    );
    expect(seen).toEqual(commands);
  });

  it('passes the block env to the runner', async () => {
    let got: Record<string, string> = {};
    const exec: Exec = (_c, env) => {
      got = env;
      return Promise.resolve({ status: 0, output: '' });
    };
    await runBlocks([block({ command: 'x', env: { A: '1' } })], exec);
    expect(got).toEqual({ A: '1' });
  });

  it('fails a file at its first non-zero exit, naming file:line, and skips the rest of it', async () => {
    const seen: string[] = [];
    const exec: Exec = (command) => {
      seen.push(command);
      return Promise.resolve({ status: command === 'bad' ? 3 : 0, output: 'boom' });
    };
    const results = await runBlocks(
      [
        block({ command: 'ok1', line: 2 }),
        block({ command: 'bad', line: 9 }),
        block({ command: 'never', line: 12 }),
        block({ command: 'other', file: 'h.md', line: 1 }),
      ],
      exec,
    );
    expect(seen).toEqual(['ok1', 'bad', 'other']);
    const failed = results.filter((r) => !r.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.failure).toContain('g.md:9');
    expect(failed[0]?.failure).toContain('exit 3');
    expect(results.find((r) => r.file === 'h.md')?.ok).toBe(true);
  });

  it('checks every expect substring against the output', async () => {
    const exec: Exec = () => Promise.resolve({ status: 0, output: 'signed in as admin' });
    const pass = await runBlocks([block({ command: 'x', expect: ['signed in', 'admin'] })], exec);
    expect(pass[0]?.ok).toBe(true);
    const fail = await runBlocks(
      [block({ command: 'x', line: 4, expect: ['signed in', 'missing text'] })],
      exec,
    );
    expect(fail[0]?.ok).toBe(false);
    expect(fail[0]?.failure).toContain('g.md:4');
    expect(fail[0]?.failure).toContain('missing text');
  });

  it('passes a block timeout to the runner as an option, not through the environment', async () => {
    const seen: { env: Record<string, string>; options: { timeoutSeconds?: number } }[] = [];
    const exec: Exec = (_c, env, options) => {
      seen.push({ env, options });
      return Promise.resolve({ status: 0, output: '' });
    };
    await runBlocks([block({ command: 'a', timeoutSeconds: 7 }), block({ command: 'b' })], exec);
    expect(seen).toEqual([
      { env: {}, options: { timeoutSeconds: 7 } },
      { env: {}, options: {} },
    ]);
  });
});
