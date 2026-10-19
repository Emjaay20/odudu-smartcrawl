import { describe, expect, it } from 'vitest';
import type { CliCommand } from '#/cli/command-types';
import { renderHelp, renderMarkdown } from '#/cli/help';
import { CLI_COMMANDS } from '#/cli/registry';

const FIXTURE: readonly CliCommand[] = [
  {
    name: 'zeta',
    summary: 'The last command alphabetically.',
    options: [],
    subcommands: [],
    example: 'odudu zeta',
  },
  {
    name: 'alpha',
    summary: 'The first command alphabetically.',
    options: [],
    subcommands: [],
    example: 'odudu alpha',
  },
];

describe('renderHelp', () => {
  it('lists commands alphabetically with their summaries', () => {
    const text = renderHelp(FIXTURE, []);

    expect(text).toContain('The first command alphabetically.');
    expect(text.indexOf('alpha')).toBeLessThan(text.indexOf('zeta'));
  });

  it('lists a command options, including --public and --client-secret', () => {
    const text = renderHelp(CLI_COMMANDS, ['seed', 'client']);

    expect(text).toContain('--public');
    expect(text).toContain('--client-secret');
    expect(text).toContain('accepts --public or --client-secret, not both');
  });

  it('marks a required option', () => {
    expect(renderHelp(CLI_COMMANDS, ['seed', 'tenant'])).toContain('--name <value> (required)');
  });

  it('lists the subcommands of a command that has them', () => {
    const text = renderHelp(CLI_COMMANDS, ['seed']);

    expect(text).toContain('registration-token');
  });

  it('throws cli_unknown_command for an unknown path', () => {
    expect(() => renderHelp(CLI_COMMANDS, ['seed', 'nope'])).toThrow(
      expect.objectContaining({ code: 'cli_unknown_command' }),
    );
    expect(() => renderHelp(CLI_COMMANDS, ['nope'])).toThrow(
      expect.objectContaining({ code: 'cli_unknown_command' }),
    );
  });

  it('keeps every line within 80 columns, for every command', () => {
    const paths: string[][] = [[]];
    for (const command of CLI_COMMANDS) {
      paths.push([command.name]);
      for (const sub of command.subcommands) paths.push([command.name, sub.name]);
    }

    for (const path of paths) {
      for (const line of renderHelp(CLI_COMMANDS, path).split('\n')) {
        expect(line.length, `${path.join(' ')}: ${line}`).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe('renderMarkdown', () => {
  it('emits one second-level heading per top-level command and tags no fence', () => {
    const text = renderMarkdown(CLI_COMMANDS);

    for (const command of CLI_COMMANDS) {
      expect(text).toContain(`\n## ${command.name}\n`);
    }
    expect(text).not.toMatch(/```[a-z]/);
  });

  it('writes a usage line that promises options only where there are some', () => {
    const text = renderMarkdown(CLI_COMMANDS);

    expect(text).toContain('```\nodudu --version\n```');
    expect(text).toContain('```\nodudu reap\n```');
    expect(text).toContain('```\nodudu init [options]\n```');
    expect(text).toContain('```\nodudu seed <command> [options]\n```');
  });
});
