import { expect } from 'vitest';

export type JsonLdNode = Record<string, unknown>;

// The nodes of every JSON-LD block, a `@graph` flattened.
export function jsonLdNodes(blocks: string[]): JsonLdNode[] {
  return blocks.flatMap((text) => {
    const parsed: unknown = JSON.parse(text);
    const block = parsed as JsonLdNode;
    const graph = block['@graph'];
    return Array.isArray(graph) ? (graph as JsonLdNode[]) : [block];
  });
}

export function expectLandingNodes(nodes: JsonLdNode[], siteUrl: string): void {
  const software = nodes.find((node) => node['@type'] === 'SoftwareApplication');
  const organisation = nodes.find((node) => node['@type'] === 'Organization');
  expect(software?.name).toBe('Odudu');
  expect(software?.isAccessibleForFree).toBe(true);
  expect(String(software?.license)).toMatch(/^https:\/\//u);
  expect(software).toHaveProperty('applicationCategory');
  expect(software).toHaveProperty('operatingSystem');
  expect(software).not.toHaveProperty('offers');
  expect(organisation?.name).toBe('Odudu');
  expect(organisation?.url).toBe(siteUrl);
  expect(String(organisation?.logo).startsWith(siteUrl)).toBe(true);
  const sameAs = organisation?.sameAs;
  expect(Array.isArray(sameAs) ? sameAs.map(String) : []).toEqual([
    expect.stringMatching(/^https:\/\/github\.com\//u),
  ]);
}
