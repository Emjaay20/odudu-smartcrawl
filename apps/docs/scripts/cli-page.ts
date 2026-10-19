import { renderHelp, renderMarkdown } from '@odudu/server/src/cli/help.ts';
import type { CliCommand } from '@odudu/server/src/cli/registry.ts';
import { escapeBody, page } from './markdown.ts';

// The command reference is the same text `odudu help` prints, laid out as a page.
export function renderCliPage(commands: readonly CliCommand[]): string {
  const body = [
    'The `odudu` command is both the server and the commands an operator runs against it. With no ' +
      'command it starts the server; the commands below do one thing and exit. They read the same ' +
      'environment as the server, described under [configuration](./configuration.md).',
    '## Usage',
    ['```', renderHelp(commands, []).trimEnd(), '```'].join('\n'),
    escapeBody(renderMarkdown(commands)),
  ].join('\n\n');
  return page(
    'Command line',
    'Every command of the odudu program, with its options and an example: init, seed, reap, send-mail, console and more.',
    body,
  );
}
