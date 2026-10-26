import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import { ADMIN_ROUTES } from '@odudu/protocol-admin';
import { buildAdminOpenApiDocument, type OpenApiDocument } from '@odudu/protocol-admin/docs';
import { areaOf, renderOpenApiPages } from './openapi-pages.ts';

const document = buildAdminOpenApiDocument();
const pages = renderOpenApiPages(document);

function operationHeading(method: string, pattern: string): string {
  return `## ${method} ${pattern.replace(/:(\w+)/gu, '{$1}')}`;
}

function allText(): string {
  return [...pages.values()].join('\n');
}

// A document of one operation whose prose is hostile to Markdown.
function hostile(): OpenApiDocument {
  const base = buildAdminOpenApiDocument();
  const operation = base.paths['/admin/tenants/{tenant}/whoami']?.get;
  if (operation === undefined) throw new Error('whoami is gone');
  return {
    ...base,
    paths: {
      '/admin/tenants/{tenant}/whoami': {
        get: {
          ...operation,
          description:
            'Say <script>alert(1)</script> & {{x}} and {y}, keep `a < b & c` as code, <!-- no -->',
          responses: {
            '200': {
              description: 'OK <img src=x onerror=alert(1)>',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      note: {
                        type: 'string',
                        description: 'A | pipe, a <b>tag</b> and {braces}\nacross two lines',
                      },
                    },
                    required: ['note'],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

// A document of the whoami operation whose success body is the given schema.
function hostileWith(schema: Record<string, unknown>): OpenApiDocument {
  const doc = hostile();
  const path = '/admin/tenants/{tenant}/whoami';
  const operation = doc.paths[path]?.get;
  if (operation === undefined) throw new Error('whoami is gone');
  return {
    ...doc,
    paths: {
      [path]: {
        get: {
          ...operation,
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema } },
            },
          },
        },
      },
    },
  };
}

function htmlNodes(markdown: string): string[] {
  const found: string[] = [];
  const visit = (node: { type: string; value?: string; children?: unknown[] }): void => {
    if (node.type === 'html' && node.value !== undefined) found.push(node.value);
    for (const child of node.children ?? []) visit(child as typeof node);
  };
  visit(fromMarkdown(markdown));
  return found;
}

describe('the admin API reference pages', () => {
  it('writes one section per operation with its method, path, capability and request and response schemas', () => {
    const text = allText();
    for (const route of ADMIN_ROUTES) {
      expect(text, `${route.method} ${route.pattern}`).toContain(
        `${operationHeading(route.method, route.pattern)}\n`,
      );
    }
    const clientsPage = pages.get('admin-api/clients.md') ?? '';
    const create = clientsPage.slice(
      clientsPage.indexOf(`${operationHeading('POST', '/admin/tenants/:tenant/clients')}\n`),
    );
    const section = create.slice(0, create.indexOf('\n## ', 3));
    expect(section).toContain('Requires the "manage-clients" capability.');
    expect(section).toContain('### Path parameters');
    expect(section).toContain('| `tenant` |');
    expect(section).toContain('### Request body');
    expect(section).toContain('| `client_id` | string | yes |');
    expect(section).toContain('### Responses');
    expect(section).toContain('#### 201 Created');
    expect(section).toContain('| `token_endpoint_auth_method` |');
    expect(section).toContain('#### 401');
  });

  it('names every route ADMIN_ROUTES lists', () => {
    const headings = [...allText().matchAll(/^## ([A-Z]+ \/\S+)$/gmu)].map((match) => match[1]);
    const listed = ADMIN_ROUTES.map(
      (route) => `${route.method} ${route.pattern.replace(/:(\w+)/gu, '{$1}')}`,
    );
    expect(headings.filter((heading) => !listed.includes(heading ?? ''))).toEqual([]);
    expect(listed.filter((entry) => !headings.includes(entry))).toEqual([]);
    expect(headings).toHaveLength(listed.length);
  });

  it('groups the routes into one page per area and an index that links each', () => {
    const index = pages.get('admin-api/index.md') ?? '';
    const areas = [...pages.keys()].filter((name) => name !== 'admin-api/index.md');
    expect(areas.length).toBeGreaterThan(10);
    for (const area of areas) {
      expect(index, area).toContain(`](./${area.replace('admin-api/', '')})`);
    }
  });

  it('splits what hangs off a subject, and refuses a sub-resource it has no page for', () => {
    const base = '/admin/tenants/{tenant}/subjects/{id}';
    expect(areaOf(`${base}/profile`)).toBe('subjects');
    expect(areaOf(`${base}/lockout`)).toBe('subject-sign-in');
    expect(areaOf(`${base}/groups`)).toBe('subject-access');
    expect(areaOf(`${base}/grants/{clientId}`)).toBe('subject-sessions');
    expect(() => areaOf(`${base}/something-new`)).toThrow(/subject-sign-in/u);
  });

  it('names the subject pages as a reader would say them', () => {
    const text = pages.get('admin-api/subject-sign-in.md') ?? '';
    expect(text).toContain('title: "Admin API: Subject sign-in"');
    expect(text).toContain("operations of the Odudu admin API on a subject's sign-in");
    expect(pages.get('admin-api/index.md')).toContain('[Subject sign-in](./subject-sign-in.md)');
  });

  it('gives every page a title and a description, and a heading for the title', () => {
    for (const [name, text] of pages) {
      expect(text, name).toMatch(/^---\ntitle: .+\ndescription: .+\n---\n/u);
      expect(text, name).toMatch(/\n# .+\n/u);
    }
  });

  it('escapes HTML in descriptions and writes .md, never .mdx', () => {
    const rendered = renderOpenApiPages(hostile());
    for (const name of rendered.keys()) expect(name.endsWith('.md'), name).toBe(true);
    const text = [...rendered.values()].join('\n');
    expect(text).not.toContain('<script');
    expect(text).not.toContain('<img');
    expect(text).not.toContain('<!-- no');
    expect(text).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; {{x}} and {y}');
    expect(text).toContain('`a < b & c`');
    for (const [name, page] of rendered) {
      const html = htmlNodes(page.replace(/^---\n[\s\S]*?\n---\n/u, ''));
      expect(
        html.filter((node) => !node.startsWith('<!-- Generated')),
        name,
      ).toEqual([]);
    }
    const row = text.split('\n').find((line) => line.startsWith('| `note` |')) ?? '';
    expect(row).toContain('A \\| pipe, a &lt;b&gt;tag&lt;/b&gt; and {braces} across two lines');
  });

  it('says constraints in words: plurals, known patterns and formats, and never a raw expression it knows', () => {
    const text = allText();
    expect(text).not.toContain('at least 1 characters');
    expect(text).not.toContain('^[^\\u0000]*$');
    expect(text).not.toContain('[0-9a-fA-F]{8}');
    expect(text).toContain('at least 1 character');
    expect(text).toContain('no bidirectional control characters');
    expect(text).toContain('a UUID');
  });

  it('shows a pattern it cannot put in words in a collapsed block after the operation', () => {
    const doc = hostileWith({ type: 'string', pattern: '^[a-z]{3}-\\d+$' });
    const text = [...renderOpenApiPages(doc).values()].join('\n');
    expect(text).toContain('matching a pattern, listed below');
    expect(text).toContain('<details>');
    expect(text).toContain('<code>^[a-z]{3}-\\d+$</code>');
  });

  it('says when it stops expanding a deeply nested schema, and where the rest is', () => {
    let nested: Record<string, unknown> = { type: 'string', description: 'The bottom.' };
    for (let level = 0; level < 8; level += 1) {
      nested = { type: 'object', properties: { inner: nested }, required: ['inner'] };
    }
    const text = [...renderOpenApiPages(hostileWith(nested)).values()].join('\n');
    expect(text).toContain('The fields inside are not listed here');
    expect(text).toContain('[OpenAPI document](pathname:///openapi/admin.json)');
  });

  it('prints how much of each area\u2019s request and response fields carry a description', () => {
    const clients = pages.get('admin-api/clients.md') ?? '';
    expect(clients).toMatch(/\nDocumentation coverage: \d+ of \d+ fields described \(\d+%\)\.\n$/u);
  });

  it('is deterministic', () => {
    const again = renderOpenApiPages(buildAdminOpenApiDocument());
    expect([...again.entries()]).toEqual([...pages.entries()]);
    expect([...pages.keys()]).toEqual([...pages.keys()].sort());
  });
});
