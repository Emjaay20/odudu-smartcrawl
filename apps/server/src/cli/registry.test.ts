import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLI_COMMANDS } from '#/cli/registry';
import { SEED_COMMANDS } from '#/cli/seed';
import type { CliCommand } from '#/cli/command-types';

function everyCommand(commands: readonly CliCommand[]): CliCommand[] {
  return commands.flatMap((command) => [command, ...everyCommand(command.subcommands)]);
}

describe('CLI_COMMANDS', () => {
  it('names every subcommand main.ts routes', () => {
    const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const routed = [...main.matchAll(/process\.argv\[2\] === '([^']+)'/g)].map((m) => m[1]);

    expect(routed.length).toBeGreaterThan(0);
    for (const name of routed) {
      expect(
        CLI_COMMANDS.map((command) => command.name),
        name,
      ).toContain(name);
    }
  });

  it('names every seed subcommand SEED_COMMANDS lists', () => {
    const seed = CLI_COMMANDS.find((command) => command.name === 'seed');

    expect(seed?.subcommands.map((command) => command.name).sort()).toEqual(
      [...SEED_COMMANDS].sort(),
    );
  });

  it('gives every option a summary of at least 12 characters', () => {
    for (const command of everyCommand(CLI_COMMANDS)) {
      for (const option of command.options) {
        expect(option.summary.length, `${command.name} --${option.name}`).toBeGreaterThanOrEqual(
          12,
        );
      }
    }
  });

  it('has an example that starts with odudu', () => {
    for (const command of everyCommand(CLI_COMMANDS)) {
      expect(command.example, command.name).toMatch(/^odudu /);
    }
  });

  it('gives every command a summary', () => {
    for (const command of everyCommand(CLI_COMMANDS)) {
      expect(command.summary.length, command.name).toBeGreaterThanOrEqual(12);
    }
  });
});
