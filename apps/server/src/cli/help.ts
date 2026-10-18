import { OduduError } from '@odudu/kernel';
import type { CliCommand, CliOption } from '#/cli/command-types';

const WIDTH = 80;
const NAME_COLUMN = 20;

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line !== '' && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function indented(text: string, indent: number): string[] {
  const pad = ' '.repeat(indent);
  return wrap(text, WIDTH - indent).map((line) => `${pad}${line}`);
}

function byName(commands: readonly CliCommand[]): CliCommand[] {
  return [...commands].sort((a, b) => a.name.localeCompare(b.name));
}

function resolve(commands: readonly CliCommand[], path: readonly string[]): CliCommand[] {
  const found: CliCommand[] = [];
  let level = commands;
  for (const name of path) {
    const next = level.find((command) => command.name === name);
    if (next === undefined) {
      throw new OduduError(
        'cli_unknown_command',
        `unknown command ${JSON.stringify(['odudu', ...path].join(' '))}`,
      );
    }
    found.push(next);
    level = next.subcommands;
  }
  return found;
}

function optionLabel(option: CliOption): string {
  return option.type === 'string' ? `--${option.name} <value>` : `--${option.name}`;
}

function optionHeading(option: CliOption): string {
  return option.required ? `${optionLabel(option)} (required)` : optionLabel(option);
}

function optionSummary(option: CliOption): string {
  return option.repeatable ? `${option.summary} (repeatable)` : option.summary;
}

function commandList(commands: readonly CliCommand[]): string[] {
  return byName(commands).flatMap((command) => {
    const [first = '', ...rest] = wrap(command.summary, WIDTH - NAME_COLUMN);
    const head = `  ${command.name.padEnd(NAME_COLUMN - 2)}${first}`;
    return [head, ...rest.map((line) => `${' '.repeat(NAME_COLUMN)}${line}`)];
  });
}

export function renderHelp(commands: readonly CliCommand[], path: readonly string[]): string {
  const chain = resolve(commands, path);
  const command = chain[chain.length - 1];
  const lines: string[] = [];

  if (command === undefined) {
    lines.push('Usage: odudu <command> [options]', '');
    lines.push('Run with no command to start the server.', '');
    lines.push('Commands:', ...commandList(commands), '');
    lines.push(
      'Run `odudu help <command>` for the options of one command,',
      'and `odudu --version` to print the version.',
    );
    return `${lines.join('\n')}\n`;
  }

  const prefix = ['odudu', ...path].join(' ');
  const usage = command.subcommands.length > 0 ? '<command> [options]' : '[options]';
  lines.push(`Usage: ${prefix} ${usage}`, '', ...indented(command.summary, 0), '');
  if (command.subcommands.length > 0) {
    lines.push('Commands:', ...commandList(command.subcommands), '');
  }
  if (command.options.length > 0) {
    lines.push('Options:');
    for (const option of command.options) {
      lines.push(`  ${optionHeading(option)}`, ...indented(optionSummary(option), 6));
    }
    lines.push('');
  }
  lines.push('Example:', `  ${command.example}`);
  return `${lines.join('\n')}\n`;
}

function markdownSection(command: CliCommand, path: readonly string[], depth: number): string[] {
  const full = [...path, command.name];
  const lines = [`${'#'.repeat(depth)} ${command.name}`, '', command.summary, ''];
  const usage = command.subcommands.length > 0 ? '<command> [options]' : '[options]';
  lines.push('```', `odudu ${full.join(' ')} ${usage}`, '```', '');
  if (command.options.length > 0) {
    for (const option of command.options) {
      lines.push(
        `- \`${optionLabel(option)}\`${option.required ? ' (required)' : ''}: ${optionSummary(option)}`,
      );
    }
    lines.push('');
  }
  lines.push('Example:', '', '```', command.example, '```', '');
  for (const sub of byName(command.subcommands)) {
    lines.push(...markdownSection(sub, full, depth + 1));
  }
  return lines;
}

export function renderMarkdown(commands: readonly CliCommand[]): string {
  const lines: string[] = [];
  for (const command of byName(commands)) lines.push(...markdownSection(command, [], 2));
  return `\n${lines.join('\n')}`.replace(/\n+$/, '\n');
}
