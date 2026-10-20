import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractRunnable, lintCommand, type RunnableBlock } from '#/parse';
import { runBlocks } from '#/run';
import { openSession } from '#/session';

// Fewer runnable blocks than this fails the run, so a guide whose commands
// were all retagged `text` cannot leave the job passing on nothing.
export const MINIMUM_BLOCKS = 0;

export interface Output {
  out(text: string): void;
  err(text: string): void;
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.mdx?$/u.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** Returns the process exit code. */
export async function runDirectories(
  roots: readonly string[],
  output: Output,
  minimum: number = MINIMUM_BLOCKS,
): Promise<number> {
  const blocks: RunnableBlock[] = [];
  for (const root of roots) {
    for (const file of await markdownFiles(root)) {
      blocks.push(...extractRunnable(await readFile(file, 'utf8'), file));
    }
  }

  const findings = blocks.flatMap((block) => lintCommand(block));
  if (findings.length > 0) {
    output.err(`${findings.join('\n')}\n`);
    return 1;
  }
  if (blocks.length < minimum) {
    output.err(
      `found ${String(blocks.length)} runnable blocks, expected at least ${String(minimum)}\n`,
    );
    return 1;
  }

  let failures = 0;
  for (const file of new Set(blocks.map((block) => block.file))) {
    const session = openSession();
    const results = await runBlocks(
      blocks.filter((block) => block.file === file),
      (command, env, options) => session.exec(command, env, options),
    );
    await session.close();
    for (const result of results) {
      if (result.ok) {
        output.out(`ok   ${result.file}:${String(result.line)}\n`);
      } else {
        failures += 1;
        output.err(`FAIL ${result.failure ?? ''}\n`);
      }
    }
  }
  output.out(`${String(blocks.length)} runnable blocks, ${String(failures)} failed\n`);
  return failures === 0 ? 0 : 1;
}
