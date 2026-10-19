import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { promptAdmin, type PromptIo } from '#/cli/prompt';

interface Rig {
  readonly io: PromptIo;
  readonly input: PassThrough;
  readonly written: () => string;
  readonly rawCalls: boolean[];
}

function rig(options: { tty?: boolean } = {}): Rig {
  const input = Object.assign(new PassThrough(), {
    isTTY: options.tty ?? true,
    setRawMode: (on: boolean) => {
      rawCalls.push(on);
    },
  });
  const rawCalls: boolean[] = [];
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
  return { io: { input, output }, input, written: () => chunks.join(''), rawCalls };
}

const accept = (): null => null;

describe('promptAdmin', () => {
  it('reads the password without echoing it', async () => {
    const { io, input, written } = rig();
    input.write('ada@example.com\ncorrect-horse-9\ncorrect-horse-9\n');

    const answer = await promptAdmin(io, accept);

    expect(answer).toEqual({ email: 'ada@example.com', password: 'correct-horse-9' });
    expect(written()).not.toContain('correct-horse-9');
  });

  it.each([
    ['quotes and a command substitution', `p'"$(id)\\n`],
    ['backticks', 'a`id`b`'],
    ['separators', 'a;b|c&d'],
    ['a tab', 'a\tb'],
    ['128 characters', 'x7!Q'.repeat(32)],
  ])(
    'reads the password byte for byte, whatever shell metacharacters it holds: %s',
    async (_, secret) => {
      const { io, input, written } = rig();
      input.write(`ada@example.com\n${secret}\n${secret}\n`);

      const answer = await promptAdmin(io, accept);

      expect(answer.password).toBe(secret);
      expect(written()).not.toContain(secret);
    },
  );

  it('asks twice and again when they differ', async () => {
    const { io, input, written } = rig();
    input.write('ada@example.com\nfirst-pw-123\nsecond-pw-456\nsame-pw-789\nsame-pw-789\n');

    const answer = await promptAdmin(io, accept);

    expect(answer.password).toBe('same-pw-789');
    expect(written()).toContain('do not match');
  });

  it('re-asks with the policy reason when validate refuses', async () => {
    const { io, input, written } = rig();
    input.write('ada@example.com\nshort\nshort\nlong-enough-1\nlong-enough-1\n');

    const answer = await promptAdmin(io, (pw) => (pw.length < 8 ? 'at least 8 characters' : null));

    expect(answer.password).toBe('long-enough-1');
    expect(written()).toContain('at least 8 characters');
    expect(written()).not.toContain('short');
  });

  it('skips the email question when one is given', async () => {
    const { io, input, written } = rig();
    input.write('pw-for-grace-1\npw-for-grace-1\n');

    const answer = await promptAdmin(io, accept, 'grace@example.com');

    expect(answer.email).toBe('grace@example.com');
    expect(written()).not.toContain('email');
  });

  it('honours backspace while the password is typed', async () => {
    const { io, input } = rig();
    input.write('ada@example.com\nabcX\x7fdef-1\nabcdef-1\n');

    const answer = await promptAdmin(io, accept);

    expect(answer.password).toBe('abcdef-1');
  });

  it('restores the terminal after Ctrl-C', async () => {
    const { io, input, rawCalls } = rig();
    input.write('ada@example.com\nabc\x03');

    await expect(promptAdmin(io, accept)).rejects.toThrow(/cancelled/u);

    expect(rawCalls).toEqual([true, false]);
  });

  it('restores the terminal when validate throws', async () => {
    const { io, input, rawCalls } = rig();
    input.write('ada@example.com\npw-pw-pw-1\npw-pw-pw-1\n');

    await expect(
      promptAdmin(io, () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(rawCalls.at(-1)).toBe(false);
    expect(rawCalls.filter((on) => on)).toHaveLength(rawCalls.filter((on) => !on).length);
  });

  it('gives up when the input ends', async () => {
    const { io, input, rawCalls } = rig();
    input.end('ada@example.com\n');

    await expect(promptAdmin(io, accept)).rejects.toThrow(/ended/u);

    expect(rawCalls.at(-1)).toBe(false);
  });

  it('refuses to prompt when input is not a TTY', async () => {
    const { io } = rig({ tty: false });

    await expect(promptAdmin(io, accept)).rejects.toThrow(/terminal/u);
  });
});
