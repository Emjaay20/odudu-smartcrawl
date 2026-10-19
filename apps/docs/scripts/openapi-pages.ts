import type { OpenApiDocument } from '@odudu/protocol-admin';
import { cell, code, codeCell, escapeProse, frontMatter, table, titleCase } from './markdown.ts';

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

function bound(label: string, value: unknown): string[] {
  return typeof value === 'number' && Math.abs(value) < SAFE_INTEGER
    ? [`${label} ${String(value)}`]
    : [];
}

function constraints(schema: Json): string[] {
  const found: string[] = [];
  const format = str(schema.format);
  if (format !== undefined) found.push(`format ${code(format)}`);
  if (schema.enum !== undefined) {
    found.push(
      `one of ${list(schema.enum)
        .map((value) => code(scalar(value)))
        .join(', ')}`,
    );
  }
  if (schema.const !== undefined) found.push(`always ${code(scalar(schema.const))}`);
  found.push(
    ...bound('minimum', schema.minimum),
    ...bound('maximum', schema.maximum),
    ...bound('at least', schema.minLength).map((text) => `${text} characters`),
    ...bound('at most', schema.maxLength).map((text) => `${text} characters`),
    ...bound('at least', schema.minItems).map((text) => `${text} items`),
    ...bound('at most', schema.maxItems).map((text) => `${text} items`),
  );
  const pattern = str(schema.pattern);
  if (pattern !== undefined) found.push(`pattern ${code(pattern)}`);
  if (schema.default !== undefined) found.push(`default ${code(scalar(schema.default))}`);
  if (schema.additionalProperties === true || record(schema.additionalProperties) !== undefined) {
    const extra = record(schema.additionalProperties);
    if (extra === undefined || Object.keys(extra).length === 0) found.push('other fields accepted');
  }
  return found;
}

function detailsOf(schema: Json): string {
  const description = str(schema.description);
  const parts = [
    ...(description === undefined ? [] : [escapeProse(description)]),
    ...constraints(schema),
  ];
  return parts
    .join('. ')
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
): void {
  const resolved = resolveRef(schema, root);
  const { schema: inner, nullable } = unwrapNullable(resolved);
  const properties = record(inner.properties);
  const items = record(inner.items);
  const isObject = properties !== undefined;

  if (path !== '' || !isObject) {
    rows.push({
      path: path === '' ? '(body)' : path,
      type: describeType(inner, nullable),
      required,
      details: detailsOf(inner),
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
      );
    }
  } else if (items !== undefined && record(resolveRef(items, root).properties) !== undefined) {
    collect(items, `${path === '' ? '' : path}[]`, true, depth + 1, rows, root);
  }
}

function resolveRef(schema: Json, root: OpenApiDocument): Json {
  const ref = str(schema.$ref);
  const prefix = '#/components/schemas/';
  if (ref?.startsWith(prefix) !== true) return schema;
  const target = record((root.components.schemas as Json)[ref.slice(prefix.length)]);
  return target ?? schema;
}

function schemaTable(schema: Json, root: OpenApiDocument): string {
  const rows: Row[] = [];
  collect(schema, '', true, 0, rows, root);
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

function parametersOf(operation: Json, root: OpenApiDocument): Parameter[] {
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

function parameterTable(parameters: readonly Parameter[]): string {
  return table(
    ['Name', 'Type', 'Required', 'Details'],
    parameters.map((parameter) => {
      const { schema, nullable } = unwrapNullable(parameter.schema);
      const details = detailsOf({
        ...schema,
        ...(parameter.description === undefined ? {} : { description: parameter.description }),
      });
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
): string[] {
  if (mediaType === 'application/problem+json') {
    return [
      `Body: ${code(mediaType)}, an RFC 9457 problem document described under [problem details](${problemLink}).`,
    ];
  }
  const schema = record(media.schema);
  return [
    `Body: ${code(mediaType)}`,
    ...(schema === undefined ? [] : ['', schemaTable(schema, root)]),
    ...examplesOf(media).flatMap((example) => ['', example]),
  ];
}

function responseBlocks(operation: Json, root: OpenApiDocument, problemLink: string): string[] {
  const lines: string[] = [];
  for (const [status, response] of Object.entries(record(operation.responses) ?? {})) {
    const found = record(response) ?? {};
    const description = str(found.description) ?? '';
    lines.push(`#### ${status} ${escapeProse(description)}`.trimEnd(), '');
    const content = Object.entries(record(found.content) ?? {});
    if (content.length === 0) lines.push('No body.', '');
    for (const [mediaType, media] of content) {
      lines.push(...mediaBlock(mediaType, record(media) ?? {}, root, problemLink), '');
    }
  }
  return lines;
}

function operationSection(
  method: string,
  path: string,
  operation: Json,
  root: OpenApiDocument,
  problemLink: string,
): string {
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
    if (ofPlace.length > 0) lines.push(`### ${label}`, '', parameterTable(ofPlace), '');
  }

  const body = record(operation.requestBody);
  if (body !== undefined) {
    lines.push('### Request body', '');
    for (const [mediaType, media] of Object.entries(record(body.content) ?? {})) {
      lines.push(...mediaBlock(mediaType, record(media) ?? {}, root, problemLink), '');
    }
  }

  lines.push('### Responses', '', ...responseBlocks(operation, root, problemLink));
  return lines.join('\n').replace(/\n+$/u, '\n');
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

function operationsOf(doc: OpenApiDocument): Map<string, Operation[]> {
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
  const description =
    `${String(operations.length)} ${noun} of the Odudu admin API on ${area.replaceAll('-', ' ')}, ` +
    'each with its method, path, required capability, parameters, request body and responses.';
  const intro =
    `The ${doc.info.title} ${area.replaceAll('-', ' ')} operations, one section each. ` +
    'Every request carries a bearer token; the [index](./index.md) says which audience it needs ' +
    'and how a refusal is shaped.';
  const sections = operations.map(({ method, path, operation }) =>
    operationSection(method, path, operation, doc, './index.md#problem-details'),
  );
  return `${frontMatter(`Admin API: ${label}`, description)}\n# Admin API: ${label}\n\n${intro}\n\n${sections.join('\n')}`;
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
    `${escapeProse(doc.info.title)}, version ${escapeProse(doc.info.version)}. Every operation is a JSON request ` +
      `under \`/admin/tenants\`. The pages are generated from the OpenAPI document the server ` +
      `itself serves at \`/admin/openapi.json\`, so they list exactly the routes the build serves.`,
    '',
    '## Authentication',
    '',
    escapeProse(str(scheme?.description) ?? 'Send a bearer token.'),
    '',
    `Each operation names the capability it needs. A caller without it is refused with \`403\`; a missing or wrong token with \`401\`.`,
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
    schemaTable(record(doc.components.schemas.ProblemDetails) ?? {}, doc),
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
