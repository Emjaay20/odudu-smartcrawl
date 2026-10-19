import { renderHelp } from '@odudu/server/src/cli/help.ts';
import { CLI_COMMANDS, type CliCommand } from '@odudu/server/src/cli/registry.ts';
import { describe, expect, it } from 'vitest';
import { renderCliPage } from './cli-page.ts';

const text = renderCliPage(CLI_COMMANDS);

function everyCommand(
  commands: readonly CliCommand[],
  depth = 2,
): { command: CliCommand; depth: number }[] {
  return commands.flatMap((command) => [
    { command, depth },
    ...everyCommand(command.subcommands, depth + 1),
  ]);
}

describe('the command line reference', () => {
  it('gives every command of the registry a heading, its example and each of its options', () => {
    const commands = everyCommand(CLI_COMMANDS);
    expect(commands.length).toBeGreaterThan(20);
    for (const { command, depth } of commands) {
      expect(text, command.name).toContain(`\n${'#'.repeat(depth)} ${command.name}\n`);
      expect(text, command.name).toContain(command.example);
      for (const option of command.options) {
        expect(text, `${command.name} --${option.name}`).toContain(`--${option.name}`);
      }
    }
  });

  it('opens with the usage `odudu help` prints', () => {
    expect(text).toContain(`\`\`\`\n${renderHelp(CLI_COMMANDS, []).trimEnd()}\n\`\`\``);
  });

  it('escapes the prose of a command and leaves its examples as written', () => {
    const hostile: CliCommand = {
      name: 'odd',
      summary: 'Writes <b>bold</b> & more.',
      options: [],
      subcommands: [],
      example: 'odudu odd --x "<y>" && true',
    };
    const page = renderCliPage([hostile]);
    expect(page).toContain('Writes &lt;b&gt;bold&lt;/b&gt; &amp; more.');
    expect(page).toContain('odudu odd --x "<y>" && true');
  });

  it('is a Markdown page with a title and a description', () => {
    expect(text).toMatch(
      /^---\ntitle: "Command line"\ndescription: ".+"\n---\n\n# Command line\n/u,
    );
  });
});
