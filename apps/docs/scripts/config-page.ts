import { CONFIG_GROUPS, configReference, type ConfigReference } from '@odudu/kernel';
import { cell, codeCell, page, table } from './markdown.ts';

const THOUSANDS = new Intl.NumberFormat('en-US');

function typeCell(row: ConfigReference): string {
  const secret = row.secret ? ', secret' : '';
  switch (row.kind) {
    case 'boolean':
      return `\`true\` or \`false\`${secret}`;
    case 'enum':
      return `one of ${(row.values ?? []).map((value) => `\`${value}\``).join(', ')}${secret}`;
    case 'integer': {
      const bounds =
        row.minimum !== undefined && row.maximum !== undefined
          ? `, ${THOUSANDS.format(row.minimum)} to ${THOUSANDS.format(row.maximum)}`
          : '';
      return `integer${bounds}${secret}`;
    }
    case 'url':
      return `URL${secret}`;
    case 'string':
      return `string${secret}`;
  }
}

function defaultCell(row: ConfigReference): string {
  if (row.required) return 'required';
  return row.default === undefined ? 'none' : codeCell(row.default);
}

export function renderConfigPage(rows: readonly ConfigReference[] = configReference()): string {
  const sections = CONFIG_GROUPS.flatMap((group) => {
    const inGroup = rows.filter((row) => row.group === group);
    if (inGroup.length === 0) return [];
    const lines = inGroup.map((row) => [
      codeCell(row.name),
      cell(typeCell(row)),
      defaultCell(row),
      cell(row.summary),
    ]);
    return [`## ${group}`, table(['Variable', 'Type', 'Default', 'Description'], lines)];
  });
  const body = [
    'Odudu is configured by environment variables, read once when the server or a command starts. A ' +
      'value that does not fit its type or bounds stops it from starting, and the message names the ' +
      'variable. A variable marked secret holds a credential: keep it out of images, logs and source control.',
    ...sections,
  ].join('\n\n');
  return page(
    'Configuration',
    'Every environment variable the Odudu server reads, with its type, bounds, default and what it does.',
    body,
  );
}
