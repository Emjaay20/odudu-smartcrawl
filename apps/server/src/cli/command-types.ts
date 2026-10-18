export interface CliOption {
  readonly name: string;
  readonly type: 'string' | 'boolean';
  readonly repeatable: boolean;
  readonly required: boolean;
  readonly summary: string;
}

export interface CliCommand {
  readonly name: string;
  readonly summary: string;
  readonly options: readonly CliOption[];
  readonly subcommands: readonly CliCommand[];
  readonly example: string;
}

export interface OptionSpec {
  readonly type: 'string' | 'boolean';
  readonly multiple?: true;
  readonly required: boolean;
  readonly summary: string;
}

export type OptionTable = Readonly<Record<string, OptionSpec>>;

// A command's options are declared once, as one of these tables. The same
// table is handed to `parseArgs` (which reads `type` and `multiple` and
// ignores the rest) and rendered by `odudu help`, so an option cannot be
// parsed without being documented. Declared `as const`-shaped so `parseArgs`
// still types each value from its own entry.
export function text(summary: string, required = false) {
  return { type: 'string', required, summary } as const;
}

export function texts(summary: string) {
  return { type: 'string', multiple: true, required: false, summary } as const;
}

export function flag(summary: string) {
  return { type: 'boolean', required: false, summary } as const;
}

export function cliOptions(table: OptionTable): CliOption[] {
  return Object.entries(table).map(([name, spec]) => ({
    name,
    type: spec.type,
    repeatable: spec.multiple === true,
    required: spec.required,
    summary: spec.summary,
  }));
}
