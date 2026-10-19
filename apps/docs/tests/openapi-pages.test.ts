import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROUTES,
  buildAdminOpenApiDocument,
  type OpenApiDocument,
} from '@odudu/protocol-admin';
import { renderOpenApiPages } from '#docs/scripts/openapi-pages.ts';

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

  it('is deterministic', () => {
    const again = renderOpenApiPages(buildAdminOpenApiDocument());
    expect([...again.entries()]).toEqual([...pages.entries()]);
    expect([...pages.keys()]).toEqual([...pages.keys()].sort());
  });
});
