import { readdirSync, readFileSync } from 'node:fs';
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

  it('lists help and --version, which main.ts answers before routing', () => {
    const names = CLI_COMMANDS.map((command) => command.name);

    expect(names).toContain('help');
    expect(names).toContain('--version');
  });
});

const CLI_DIR = new URL('./', import.meta.url);

function sources(): { file: string; text: string }[] {
  return readdirSync(CLI_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => ({ file, text: readFileSync(new URL(file, CLI_DIR), 'utf8') }));
}

describe('option metadata', () => {
  it('is the table parseArgs reads, never an inline copy', () => {
    let calls = 0;
    for (const { file, text } of sources()) {
      for (const match of text.matchAll(/parseArgs\(\{/g)) {
        calls += 1;
        const call = text.slice(match.index, match.index + 120);
        expect(call, `${file}: ${call}`).toMatch(/options:\s*[A-Z][A-Z_]*_OPTIONS\b/);
      }
    }
    expect(calls).toBeGreaterThan(10);
  });

  it('marks required exactly the options the command refuses to run without', () => {
    const refused = new Map<string, string[]>();
    const pattern = /(seed|console)( [a-z-]+)? requires ((?:--[a-z-]+(?:, | and )?)+)/g;
    for (const { text } of sources()) {
      for (const match of text.matchAll(pattern)) {
        const key = `${match[1] ?? ''}${match[2] ?? ''}`;
        if (refused.has(key)) continue;
        refused.set(
          key,
          [...(match[3] ?? '').matchAll(/--([a-z-]+)/g)].map((m) => m[1] ?? ''),
        );
      }
    }

    const seed = CLI_COMMANDS.find((command) => command.name === 'seed');
    const console_ = CLI_COMMANDS.find((command) => command.name === 'console');
    const checked: [string, CliCommand | undefined][] = [
      ['seed', seed],
      ...(seed?.subcommands ?? []).map((c): [string, CliCommand] => [`seed ${c.name}`, c]),
      ['console assertion', console_?.subcommands.find((c) => c.name === 'assertion')],
    ];
    for (const [key, command] of checked) {
      const required = (command?.options ?? [])
        .filter((option) => option.required)
        .map((option) => option.name);
      expect(required.sort(), key).toEqual([...(refused.get(key) ?? [])].sort());
    }
    expect(refused.size).toBe(checked.length);
  });
});
