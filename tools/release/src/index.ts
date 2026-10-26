import { appendFileSync, readFileSync } from 'node:fs';
import { releaseNotes } from '#/notes';
import { stampCompose } from '#/stamp';
import { githubOutput, parseTag } from '#/version';

const USAGE = `usage:
  index.ts tags <git-tag> <image-repository> [existing-tags-file]
                                               writes version, prerelease, latest and tags to $GITHUB_OUTPUT
  index.ts notes <changelog> <version>         prints that version's section
  index.ts stamp-compose <compose> <version>   prints the file with the release's image tag`;

const [command, first, second, third] = process.argv.slice(2);

if (command === 'tags' && first !== undefined && second !== undefined) {
  const existing = third === undefined ? [] : readFileSync(third, 'utf8').split('\n');
  const output = githubOutput(second, parseTag(first, existing));
  process.stdout.write(output);
  const target = process.env.GITHUB_OUTPUT;
  if (target !== undefined) appendFileSync(target, output);
} else if (command === 'notes' && first !== undefined && second !== undefined) {
  process.stdout.write(`${releaseNotes(readFileSync(first, 'utf8'), second)}\n`);
} else if (command === 'stamp-compose' && first !== undefined && second !== undefined) {
  process.stdout.write(stampCompose(readFileSync(first, 'utf8'), second));
} else {
  throw new Error(USAGE);
}
