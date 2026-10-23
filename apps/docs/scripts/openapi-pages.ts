import type { OpenApiDocument } from '@odudu/protocol-admin/docs';
import {
  cell,
  code,
  codeCell,
  codeHtml,
  escapeProse,
  frontMatter,
  table,
  titleCase,
} from './markdown.ts';

type Json = Readonly<Record<string, unknown>>;

const PAGE_DIR = 'admin-api';
const MAX_DEPTH = 5;
// What the generator that wrote the document uses for an unbounded integer.
const SAFE_INTEGER = 9_007_199_254_740_991;
const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete'];

function record(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : [];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function scalar(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

interface Row {
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly details: string;
  readonly described: boolean;
}

function typeOf(schema: Json): string {
  const type = schema.type;
  if (Array.isArray(type)) return list(type).map(scalar).join(' or ');
  if (typeof type === 'string') return type;
  if (schema.enum !== undefined) return 'enum';
  if (schema.const !== undefined) return 'constant';
  return 'any';
}

function variantsOf(schema: Json): readonly Json[] {
  return [...list(schema.anyOf), ...list(schema.oneOf)].flatMap((variant) => {
    const found = record(variant);
    return found === undefined ? [] : [found];
  });
}

function bound(label: string, value: unknown, unit?: string): string[] {
  if (typeof value !== 'number' || Math.abs(value) >= SAFE_INTEGER) return [];
  const noun = unit === undefined ? '' : ` ${value === 1 ? unit : `${unit}s`}`;
  return [`${label} ${String(value)}${noun}`];
}

// What a pattern says in words, for the patterns the contracts use. A pattern
// that is not here is printed as written, in a block after the operation.
const PATTERN_WORDS: readonly (readonly [test: (pattern: string) => boolean, words: string])[] = [
  [(pattern) => pattern === '^[^\\u0000]*$', ''],
  [
    (pattern) => pattern === '^[^\\u202A-\\u202E\\u2066-\\u2069]*$',
    'no bidirectional control characters',
  ],
  [(pattern) => /^\^\(?\[0-9a-fA-F\]\{8\}-/u.test(pattern), 'a UUID'],
  [(pattern) => pattern.startsWith('^(?:(?:\\d\\d[2468]'), 'an ISO 8601 date and time'],
];

const FORMAT_WORDS: Readonly<Record<string, string>> = {
  uuid: 'a UUID',
  'date-time': 'an ISO 8601 date and time',
  uri: 'an absolute URL',
  email: 'an email address',
};

function constraints(schema: Json, unknown: string[]): string[] {
  const found: string[] = [];
  const format = str(schema.format);
  const pattern = str(schema.pattern);
  const words = pattern === undefined ? undefined : PATTERN_WORDS.find(([test]) => test(pattern));
  const formatWords = format === undefined ? undefined : FORMAT_WORDS[format];
  if (format !== undefined && formatWords !== undefined) found.push(formatWords);
  else if (format !== undefined) found.push(`format ${code(format)}`);
  if (words !== undefined && words[1] !== '' && words[1] !== formatWords) found.push(words[1]);
  if (pattern !== undefined && words === undefined) {
    unknown.push(pattern);
    found.push('matching a pattern, listed below');
  }
  if (schema.enum !== undefined) {
    found.push(
      `one of ${list(schema.enum)
        .map((value) => code(scalar(value)))
        .join(', ')}`,
    );
  }
  if (schema.const !== undefined) found.push(`always ${code(scalar(schema.const))}`);
  found.push(
    ...bound('at least', schema.minimum),
    ...bound('at most', schema.maximum),
    ...bound('at least', schema.minLength, 'character'),
    ...bound('at most', schema.maxLength, 'character'),
    ...bound('at least', schema.minItems, 'item'),
    ...bound('at most', schema.maxItems, 'item'),
  );
  if (schema.default !== undefined) found.push(`default ${code(scalar(schema.default))}`);
  if (schema.additionalProperties === true || record(schema.additionalProperties) !== undefined) {
    const extra = record(schema.additionalProperties);
    if (extra === undefined || Object.keys(extra).length === 0) found.push('other fields accepted');
  }
  return found;
}

const OPENAPI_LINK = '[OpenAPI document](pathname:///openapi/admin.json)';

function sentence(text: string): string {
  return /[.!?:)`]$/u.test(text) ? text : `${text}.`;
}

function detailsOf(schema: Json, unknown: string[], truncated = false): string {
  const description = str(schema.description);
  const limits = constraints(schema, unknown);
  const parts = [
    ...(description === undefined ? [] : [sentence(escapeProse(description.trim()))]),
    ...(limits.length === 0 ? [] : [`Constraints: ${limits.join(', ')}.`]),
    ...(truncated ? [`The fields inside are not listed here; the ${OPENAPI_LINK} has them.`] : []),
  ];
  return parts
    .join(' ')
    .replace(/\s*\n\s*/gu, ' ')
    .replaceAll('|', '\\|');
}

// A nullable field is an `anyOf` of the field and `null`.
function unwrapNullable(schema: Json): { schema: Json; nullable: boolean } {
  const variants = variantsOf(schema);
  const others = variants.filter((variant) => variant.type !== 'null');
  const [only] = others;
  if (others.length === 1 && only !== undefined && others.length < variants.length) {
    const description = str(schema.description);
    return {
      schema:
        description === undefined || str(only.description) !== undefined
          ? only
          : { ...only, description },
      nullable: true,
    };
  }
  return { schema, nullable: false };
}

function describeType(schema: Json, nullable: boolean): string {
  const variants = variantsOf(schema);
  const base =
    variants.length > 1
      ? [...new Set(variants.map(typeOf))].join(' or ')
      : schema.type === 'array'
        ? `array of ${typeOf(record(schema.items) ?? {})}`
        : typeOf(schema);
  return nullable ? `${base} or null` : base;
}

function collect(
  schema: Json,
  path: string,
  required: boolean,
  depth: number,
  rows: Row[],
  root: OpenApiDocument,
  unknown: string[],
): void {
  const resolved = resolveRef(schema, root);
  const { schema: inner, nullable } = unwrapNullable(resolved);
  const properties = record(inner.properties);
  const items = record(inner.items);
  const isObject = properties !== undefined;

  const hasChildren =
    isObject || (items !== undefined && record(resolveRef(items, root).properties) !== undefined);
  const truncated = depth >= MAX_DEPTH && hasChildren;
  if (path !== '' || !isObject) {
    rows.push({
      path: path === '' ? '(body)' : path,
      type: describeType(inner, nullable),
      required,
      details: detailsOf(inner, unknown, truncated),
      described: (str(inner.description) ?? '').trim() !== '',
    });
  }
  if (depth >= MAX_DEPTH) return;
  if (isObject) {
    const requiredNames = new Set(list(inner.required).map(scalar));
    for (const [name, property] of Object.entries(properties)) {
      const child = record(property) ?? {};
      collect(
        child,
        path === '' ? name : `${path}.${name}`,
        requiredNames.has(name),
        depth + 1,
        rows,
        root,
        unknown,
      );
    }
  } else if (items !== undefined && record(resolveRef(items, root).properties) !== undefined) {
    collect(items, `${path === '' ? '' : path}[]`, true, depth + 1, rows, root, unknown);
  }
}

function resolveRef(schema: Json, root: OpenApiDocument): Json {
  const ref = str(schema.$ref);
  const prefix = '#/components/schemas/';
  if (ref?.startsWith(prefix) !== true) return schema;
  const target = record((root.components.schemas as Json)[ref.slice(prefix.length)]);
  return target ?? schema;
}

export function fieldRows(schema: Json, root: OpenApiDocument, unknown: string[]): Row[] {
  const rows: Row[] = [];
  collect(schema, '', true, 0, rows, root, unknown);
  return rows;
}

function schemaTable(schema: Json, root: OpenApiDocument, unknown: string[]): string {
  const rows = fieldRows(schema, root, unknown);
  return table(
    ['Field', 'Type', 'Required', 'Details'],
    rows.map((row) => [
      codeCell(row.path),
      cell(row.type),
      row.required ? 'yes' : 'no',
      row.details,
    ]),
  );
}

interface Parameter {
  readonly name: string;
  readonly in: string;
  readonly required: boolean;
  readonly description: string | undefined;
  readonly schema: Json;
}

export function parametersOf(operation: Json, root: OpenApiDocument): Parameter[] {
  return list(operation.parameters).flatMap((entry) => {
    const found = record(entry);
    if (found === undefined) return [];
    const ref = str(found.$ref);
    const prefix = '#/components/parameters/';
    const parameter =
      ref?.startsWith(prefix) === true
        ? record((root.components.parameters as Json)[ref.slice(prefix.length)])
        : found;
    const name = str(parameter?.name);
    if (parameter === undefined || name === undefined) return [];
    return [
      {
        name,
        in: str(parameter.in) ?? 'query',
        required: parameter.required === true,
        description: str(parameter.description),
        schema: record(parameter.schema) ?? {},
      },
    ];
  });
}

function parameterTable(parameters: readonly Parameter[], unknown: string[]): string {
  return table(
    ['Name', 'Type', 'Required', 'Details'],
    parameters.map((parameter) => {
      const { schema, nullable } = unwrapNullable(parameter.schema);
      const details = detailsOf(
        {
          ...schema,
          ...(parameter.description === undefined ? {} : { description: parameter.description }),
        },
        unknown,
      );
      return [
        codeCell(parameter.name),
        cell(describeType(schema, nullable)),
        parameter.required ? 'yes' : 'no',
        details,
      ];
    }),
  );
}

function examplesOf(media: Json): string[] {
  const schema = record(media.schema);
  const values: unknown[] = [];
  if (media.example !== undefined) values.push(media.example);
  for (const example of Object.values(record(media.examples) ?? {})) {
    const value = record(example)?.value;
    if (value !== undefined) values.push(value);
  }
  values.push(...list(schema?.examples));
  return values.map((value) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``);
}

function mediaBlock(
  mediaType: string,
  media: Json,
  root: OpenApiDocument,
  problemLink: string,
  unknown: string[],
): string[] {
  if (mediaType === 'application/problem+json') {
    return [
      `Body: ${code(mediaType)}, an RFC 9457 problem document described under [problem details](${problemLink}).`,
    ];
  }
  const schema = record(media.schema);
  return [
    `Body: ${code(mediaType)}`,
    ...(schema === undefined ? [] : ['', schemaTable(schema, root, unknown)]),
    ...examplesOf(media).flatMap((example) => ['', example]),
  ];
}

function responseBlocks(
  operation: Json,
  root: OpenApiDocument,
  problemLink: string,
  unknown: string[],
): string[] {
  const lines: string[] = [];
  for (const [status, response] of Object.entries(record(operation.responses) ?? {})) {
    const found = record(response) ?? {};
    const description = str(found.description) ?? '';
    lines.push(`#### ${status} ${escapeProse(description)}`.trimEnd(), '');
    const content = Object.entries(record(found.content) ?? {});
    if (content.length === 0) lines.push('No body.', '');
    for (const [mediaType, media] of content) {
      lines.push(...mediaBlock(mediaType, record(media) ?? {}, root, problemLink, unknown), '');
    }
  }
  return lines;
}

// A pattern the generator cannot put in words is shown as the contract states it.
function patternBlock(patterns: readonly string[]): string {
  const items = [...new Set(patterns)].map((pattern) => `<li>${codeHtml(pattern)}</li>`);
  return [
    '<details>',
    '<summary>Patterns this operation applies</summary>',
    `<ul>${items.join('')}</ul>`,
    '</details>',
    '',
  ].join('\n');
}

function operationSection(
  method: string,
  path: string,
  operation: Json,
  root: OpenApiDocument,
  problemLink: string,
): string {
  const unknown: string[] = [];
  const lines = [`## ${method.toUpperCase()} ${path}`, ''];
  const summary = str(operation.summary);
  if (summary !== undefined) lines.push(escapeProse(summary), '');
  const description = str(operation.description);
  if (description !== undefined) lines.push(escapeProse(description), '');

  const parameters = parametersOf(operation, root);
  for (const [place, label] of [
    ['path', 'Path parameters'],
    ['query', 'Query parameters'],
  ] as const) {
    const ofPlace = parameters.filter((parameter) => parameter.in === place);
    if (ofPlace.length > 0) lines.push(`### ${label}`, '', parameterTable(ofPlace, unknown), '');
  }

  const body = record(operation.requestBody);
  if (body !== undefined) {
    lines.push('### Request body', '');
    for (const [mediaType, media] of Object.entries(record(body.content) ?? {})) {
      lines.push(...mediaBlock(mediaType, record(media) ?? {}, root, problemLink, unknown), '');
    }
  }

  lines.push('### Responses', '', ...responseBlocks(operation, root, problemLink, unknown));
  if (unknown.length > 0) lines.push(patternBlock(unknown));
  return lines.join('\n').replace(/\n+$/u, '\n');
}

export interface Coverage {
  readonly described: number;
  readonly total: number;
}

// The fields a reader of an operation meets: its query parameters, its request
// body and the body of its success response, and how many carry a description.
function coverageOf(operation: Json, root: OpenApiDocument): Coverage {
  const rows: boolean[] = [];
  const sink: string[] = [];
  for (const parameter of parametersOf(operation, root)) {
    if (parameter.in !== 'query') continue;
    rows.push((parameter.description ?? str(parameter.schema.description) ?? '').trim() !== '');
  }
  const schemas: Json[] = [];
  for (const media of Object.values(record(record(operation.requestBody)?.content) ?? {})) {
    const schema = record(record(media)?.schema);
    if (schema !== undefined) schemas.push(schema);
  }
  for (const [status, response] of Object.entries(record(operation.responses) ?? {})) {
    if (!status.startsWith('2')) continue;
    for (const [mediaType, media] of Object.entries(record(record(response)?.content) ?? {})) {
      const schema = record(record(media)?.schema);
      if (schema !== undefined && mediaType !== 'application/problem+json') schemas.push(schema);
    }
  }
  for (const schema of schemas) {
    for (const row of fieldRows(schema, root, sink)) {
      if (row.path !== '(body)' && !row.path.endsWith('[]')) rows.push(row.described);
    }
  }
  return { described: rows.filter(Boolean).length, total: rows.length };
}

export function coverageOfArea(
  operations: readonly { readonly operation: Json }[],
  root: OpenApiDocument,
): Coverage {
  return operations.reduce<Coverage>(
    (sum, { operation }) => {
      const found = coverageOf(operation, root);
      return { described: sum.described + found.described, total: sum.total + found.total };
    },
    { described: 0, total: 0 },
  );
}

export function coverageLine(coverage: Coverage): string {
  const percent =
    coverage.total === 0 ? 100 : Math.floor((100 * coverage.described) / coverage.total);
  return `Documentation coverage: ${String(coverage.described)} of ${String(coverage.total)} fields described (${String(percent)}%).`;
}

export function areaOf(path: string): string {
  const parts = path.split('/').filter((part) => part !== '');
  const [, first, second, third] = parts;
  if (first === 'tenant-imports') return 'tenants';
  if (first === 'tenants') {
    if (second === undefined || second === 'count') return 'tenants';
    if (second.startsWith('{'))
      return third === undefined || third === 'export' ? 'tenants' : third;
  }
  return first ?? 'other';
}

interface Operation {
  readonly method: string;
  readonly path: string;
  readonly operation: Json;
}

export function operationsOf(doc: OpenApiDocument): Map<string, Operation[]> {
  const areas = new Map<string, Operation[]>();
  for (const [path, methods] of Object.entries(doc.paths)) {
    const ordered = Object.entries(methods).sort(
      ([a], [b]) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b),
    );
    for (const [method, operation] of ordered) {
      const area = areaOf(path);
      areas.set(area, [
        ...(areas.get(area) ?? []),
        { method, path, operation: record(operation) ?? {} },
      ]);
    }
  }
  return areas;
}

function areaPage(area: string, operations: readonly Operation[], doc: OpenApiDocument): string {
  const label = titleCase(area);
  const noun = operations.length === 1 ? 'operation' : 'operations';
  const subject = area.replaceAll('-', ' ');
  const description =
    `${String(operations.length)} ${noun} of the Odudu admin API on ${subject}, ` +
    'each with its method, path, required capability, parameters, request body and responses.';
  const intro =
    `Operations on ${subject} in the ${doc.info.title}, one section each. ` +
    'Every request carries a bearer token; the [index](./index.md) says which audience it needs ' +
    'and how a refusal is shaped.';
  const sections = operations.map(({ method, path, operation }) =>
    operationSection(method, path, operation, doc, './index.md#problem-details'),
  );
  const footer = coverageLine(coverageOfArea(operations, doc));
  return `${frontMatter(`Admin API: ${label}`, description)}\n# Admin API: ${label}\n\n${intro}\n\n${sections.join('\n')}\n${footer}\n`;
}

function indexPage(areas: ReadonlyMap<string, readonly Operation[]>, doc: OpenApiDocument): string {
  const scheme = record(doc.components.securitySchemes.bearerAuth);
  const tenant = record(doc.components.parameters.tenant);
  const total = [...areas.values()].reduce((sum, operations) => sum + operations.length, 0);
  const lines = [
    frontMatter(
      'Admin API',
      `The Odudu admin API: ${String(total)} operations over HTTP and JSON, grouped by area, with authentication and the shape of an error.`,
    ),
    '# Admin API',
    '',
    `${escapeProse(doc.info.title)}. Every operation is a JSON request ` +
      `under \`/admin/tenants\`. The pages are generated from the OpenAPI document the server ` +
      `itself serves at \`/admin/openapi.json\`, so they list exactly the routes the build serves.`,
    '',
    '## Authentication',
    '',
    escapeProse(str(scheme?.description) ?? 'Send a bearer token.'),
    '',
    `Each operation names the capability it needs. A caller without it is refused with \`403\`; a missing or wrong token with \`401\`.`,
    '',
    'Text values in a request may not contain the NUL character.',
    '',
    '## The tenant in the path',
    '',
    escapeProse(str(tenant?.description) ?? ''),
    '',
    '## Areas',
    '',
    ...[...areas].map(
      ([area, operations]) =>
        `- [${titleCase(area)}](./${area}.md): ${String(operations.length)} ${operations.length === 1 ? 'operation' : 'operations'}.`,
    ),
    '',
    '## Problem details',
    '',
    'A refusal is an `application/problem+json` document (RFC 9457) with these fields.',
    '',
    schemaTable(record(doc.components.schemas.ProblemDetails) ?? {}, doc, []),
    '',
  ];
  return lines.join('\n');
}

// One page per area of the admin API, and an index, as Markdown by path
// relative to the generated reference directory.
export function renderOpenApiPages(doc: OpenApiDocument): ReadonlyMap<string, string> {
  const areas = operationsOf(doc);
  const pages = new Map<string, string>([[`${PAGE_DIR}/index.md`, indexPage(areas, doc)]]);
  for (const [area, operations] of areas) {
    pages.set(`${PAGE_DIR}/${area}.md`, areaPage(area, operations, doc));
  }
  return new Map([...pages].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
