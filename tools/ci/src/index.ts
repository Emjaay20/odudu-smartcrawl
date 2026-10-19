import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { classifyChanges } from '#/changes';
import { mergeReports } from '#/merge-reports';

const [command, ...args] = process.argv.slice(2);

function filesChangedSince(base: string): string[] | undefined {
  try {
    const out = execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', `${base}...HEAD`],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return out.split('\0').filter((line) => line !== '');
  } catch (error) {
    console.error(`git diff against ${base} failed, running everything: ${String(error)}`);
    return undefined;
  }
}

if (command === 'changes') {
  const [base] = args;
  const changes = classifyChanges(base === undefined ? undefined : filesChangedSince(base));
  const lines = Object.entries(changes).map(([name, value]) => `${name}=${String(value)}`);
  console.log(lines.join('\n'));
  const output = process.env.GITHUB_OUTPUT;
  if (output !== undefined) appendFileSync(output, `${lines.join('\n')}\n`);
} else if (command === 'merge-reports') {
  const [out, ...shards] = args;
  if (out === undefined) throw new Error('usage: merge-reports <out> <report>...');
  await mergeReports(out, shards);
} else {
  throw new Error('usage: index.ts changes [<base-ref>] | merge-reports <out> <report>...');
}
