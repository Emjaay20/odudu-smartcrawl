import {
  CONFIG_GROUPS,
  configReference,
  OUTSIDE_LOADER_ENV,
  type ConfigReference,
} from '@odudu/kernel/docs';
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
  if (row.requiredWhen !== undefined) return `none; required when ${row.requiredWhen}`;
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
  const always = rows.filter((row) => row.required).map((row) => `\`${row.name}\``);
  const conditional = rows.flatMap((row) =>
    row.requiredWhen === undefined ? [] : [`- \`${row.name}\`, when ${row.requiredWhen}.`],
  );
  const outside = Object.entries(OUTSIDE_LOADER_ENV).map(([name, summary]) => [
    codeCell(name),
    cell(summary),
  ]);
  const body = [
    'Odudu is configured by environment variables, read once when the server or a command starts. A ' +
      'value that does not fit its type or bounds stops it from starting, and the message names the ' +
      'variable. A variable marked secret holds a credential: keep it out of images, logs and source control.',
    '## What you must set\n\n' +
      `The server does not start without ${always.join(' and ')}. The console is on by default, so by ` +
      'default it also needs the variables below; set `ODUDU_CONSOLE=false` to run without it.\n\n' +
      conditional.join('\n'),
    ...sections,
    '## Read by commands and the image\n\nThese are read from the environment by a command or the ' +
      'release image rather than by the server\u2019s configuration, so a mistake in them does not ' +
      'stop the server.\n\n' +
      table(['Variable', 'Description'], outside),
  ].join('\n\n');
  return page(
    'Configuration',
    'Every environment variable the Odudu server and its commands read, with type, bounds, default, which are required and what each does.',
    body,
  );
}
