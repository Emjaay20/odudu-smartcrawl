import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/u;
const source = readFileSync(path.join(DOCS_ROOT, 'content/en/quick-start/index.md'), 'utf8');
const nodes = fromMarkdown(source.replace(FRONT_MATTER, '')).children;

type Node = (typeof nodes)[number];

function linksIn(node: unknown): string[] {
  if (typeof node !== 'object' || node === null) return [];
  const own = 'url' in node && typeof node.url === 'string' ? [node.url] : [];
  const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
  return [...own, ...children.flatMap((child: unknown) => linksIn(child))];
}

function toString(node: unknown): string {
  if (typeof node !== 'object' || node === null) return '';
  if ('value' in node && typeof node.value === 'string') return node.value;
  const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
  return children.map((child: unknown) => toString(child)).join(' ');
}

const firstCode = nodes.findIndex((node) => node.type === 'code');
const code = (node: Node | undefined): string => (node?.type === 'code' ? node.value : '');
const headingIndex = (pattern: RegExp): number =>
  nodes.findIndex((node) => node.type === 'heading' && pattern.test(toString(node)));

describe('the quick start', () => {
  it('has the one command in the first code block on the page', () => {
    const first = code(nodes[firstCode]);
    expect(first).toContain(
      'curl -fsSLO https://github.com/wizzywit/odudu/releases/latest/download/compose.yaml',
    );
    expect(first).toContain('docker compose up');
    expect(first.split('\n').filter((line) => line.trim() !== '')).toHaveLength(1);
  });

  it('is under 400 words before the first command', () => {
    const before = nodes
      .slice(0, firstCode)
      .map((node) => toString(node))
      .join(' ');
    expect(before.split(/\s+/u).filter(Boolean).length).toBeLessThan(400);
  });

  it('shows where the generated password is printed before it names any concept', () => {
    const logs = nodes.findIndex((node) => code(node).includes('docker compose logs setup'));
    const signIn = headingIndex(/sign in to the console/iu);
    const firstConcept = nodes.findIndex((node) =>
      linksIn(node).some((url) => url.includes('/concepts/')),
    );
    expect(logs).toBeGreaterThan(firstCode - 1);
    expect(signIn).toBeGreaterThan(-1);
    expect(firstConcept).toBeGreaterThan(Math.max(logs, signIn));
  });

  it('states where a port conflict is fixed', () => {
    const at = headingIndex(/port/iu);
    expect(at).toBeGreaterThan(firstCode);
    const section = nodes
      .slice(at, at + 6)
      .map((node) => toString(node))
      .join('\n');
    expect(section).toContain('ODUDU_PORT');
  });

  it('tells the reader to remove the setup container once the password is copied', () => {
    const removal = nodes.findIndex((node) => code(node) === 'docker compose rm -f setup');
    const logs = nodes.findIndex((node) => code(node).includes('docker compose logs setup'));
    expect(removal).toBeGreaterThan(logs);
    const prose = toString(nodes[removal - 1]);
    expect(prose).toMatch(/log/iu);
  });
});
