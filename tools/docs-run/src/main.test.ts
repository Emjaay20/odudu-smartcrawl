import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MINIMUM_BLOCKS, runDirectories } from '#/main';

async function guides(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'docs-run-'));
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text);
  return dir;
}

function capture(): {
  out: string[];
  err: string[];
  io: { out(t: string): void; err(t: string): void };
} {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (t) => out.push(t), err: (t) => err.push(t) } };
}

describe('runDirectories', () => {
  it('runs a file in one shell and exits 0', async () => {
    const dir = await guides({
      'a.md': '```sh {run}\ncd /\n```\n\n```sh {run expect="/"}\npwd\n```\n',
    });
    const c = capture();
    expect(await runDirectories([dir], c.io, 1)).toBe(0);
    expect(c.out.join('')).toContain('2 runnable blocks, 0 failed');
  });

  it('exits 1 and names file:line when a block fails, and still runs the other files', async () => {
    const dir = await guides({
      'a.md': '```sh {run}\nfalse\n```\n',
      'b.md': '```sh {run}\ntrue\n```\n',
    });
    const c = capture();
    expect(await runDirectories([dir], c.io, 0)).toBe(1);
    expect(c.err.join('')).toMatch(/a\.md:1: exit 1/u);
    expect(c.out.join('')).toContain('b.md:1');
  });

  it('refuses a command the lint rejects before running anything', async () => {
    const dir = await guides({ 'a.md': '```sh {run}\necho ‘x’\n```\n' });
    const c = capture();
    expect(await runDirectories([dir], c.io, 0)).toBe(1);
    expect(c.err.join('')).toContain('U+2018');
    expect(c.out.join('')).toBe('');
  });

  it('fails below the floor of runnable blocks', async () => {
    const dir = await guides({ 'a.md': '```text\necho illustrative\n```\n' });
    const c = capture();
    expect(await runDirectories([dir], c.io, 1)).toBe(1);
    expect(c.err.join('')).toContain('expected at least 1');
  });

  it('applies the floor by default, so raising it fails a run that finds fewer blocks', async () => {
    const dir = await guides({ 'a.md': '# no commands\n' });
    expect(await runDirectories([dir], capture().io)).toBe(Math.sign(MINIMUM_BLOCKS));
  });
});
