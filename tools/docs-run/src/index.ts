import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractRunnable, lintCommand, type RunnableBlock } from '#/parse';
import { runBlocks } from '#/run';
import { openSession } from '#/session';

// Fewer runnable blocks than this fails the run, so a guide whose commands
// were all retagged `text` cannot leave the job passing on nothing.
export const MINIMUM_BLOCKS = 0;

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.mdx?$/u.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  process.stderr.write('usage: odudu-docs-run <directory>...\n');
  process.exit(2);
}

const blocks: RunnableBlock[] = [];
for (const root of roots) {
  for (const file of await markdownFiles(root)) {
    blocks.push(...extractRunnable(await readFile(file, 'utf8'), file));
  }
}

const findings = blocks.flatMap((block) => lintCommand(block));
if (findings.length > 0) {
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exit(1);
}
if (blocks.length < MINIMUM_BLOCKS) {
  process.stderr.write(
    `found ${String(blocks.length)} runnable blocks, expected at least ${String(MINIMUM_BLOCKS)}\n`,
  );
  process.exit(1);
}

let failures = 0;
for (const file of new Set(blocks.map((block) => block.file))) {
  const session = openSession();
  const results = await runBlocks(
    blocks.filter((block) => block.file === file),
    (command, env) => session.exec(command, env),
  );
  session.close();
  for (const result of results) {
    if (result.ok) {
      process.stdout.write(`ok   ${result.file}:${String(result.line)}\n`);
    } else {
      failures += 1;
      process.stderr.write(`FAIL ${result.failure ?? ''}\n`);
    }
  }
}
process.stdout.write(`${String(blocks.length)} runnable blocks, ${String(failures)} failed\n`);
process.exit(failures === 0 ? 0 : 1);
