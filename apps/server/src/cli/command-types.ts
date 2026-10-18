export interface CliOption {
  readonly name: string;
  readonly type: 'string' | 'boolean';
  readonly repeatable: boolean;
  readonly summary: string;
}

export interface CliCommand {
  readonly name: string;
  readonly summary: string;
  readonly options: readonly CliOption[];
  readonly subcommands: readonly CliCommand[];
  readonly example: string;
}

export function stringOption(name: string, summary: string): CliOption {
  return { name, type: 'string', repeatable: false, summary };
}

export function repeatableOption(name: string, summary: string): CliOption {
  return { name, type: 'string', repeatable: true, summary };
}

export function flagOption(name: string, summary: string): CliOption {
  return { name, type: 'boolean', repeatable: false, summary };
}
