import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import { PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir, load, type Target } from '#docs/tests/support/dist.ts';

const CONTENT = path.join(DOCS_ROOT, 'content/en');
const BASES: Record<Target, string> = { pages: PAGES_BASE, image: '/docs/' };

// The transcripts are captured output. A page that renders one differently
// from its source shows a reader bytes the server never sent.
const DIRECTORIES = [
  'reference/transcripts/request-paths',
  'reference/transcripts/admin-paths',
  'reference/transcripts/console-paths',
];

function pagesIn(directory: string): string[] {
  const order: unknown = JSON.parse(
    readFileSync(path.join(CONTENT, directory, 'order.json'), 'utf8'),
  );
  return order as string[];
}

function fencedBlocksOf(source: string): string[] {
  return fromMarkdown(source.replace(/^---\n[\s\S]*?\n---\n/u, ''))
    .children.filter((node) => node.type === 'code')
    .map((node) => node.value);
}

function routeOf(directory: string, page: string, base: string): string {
  const slug = page === 'index.md' ? '' : `${page.replace(/\.md$/u, '')}/`;
  return `${base}${directory}/${slug}`;
}

function renderedBlocks(file: string): string[] {
  const $ = load(file);
  return $('pre.prism-code')
    .map((_, pre) =>
      $(pre)
        .find('.token-line')
        .map((__, line) => $(line).text().replace(/\n$/u, ''))
        .get()
        .join('\n'),
    )
    .get();
}

describe('the transcript pages', () => {
  for (const target of ['pages', 'image'] as const) {
    it(`renders a fenced transcript byte for byte in the ${target} build`, () => {
      const dir = distDir(target);
      const base = BASES[target];
      let blocks = 0;
      const different: string[] = [];
      for (const directory of DIRECTORIES) {
        for (const page of pagesIn(directory)) {
          const expected = fencedBlocksOf(
            readFileSync(path.join(CONTENT, directory, page), 'utf8'),
          );
          const route = routeOf(directory, page, base);
          const actual = renderedBlocks(path.join(dir, route.slice(base.length), 'index.html'));
          blocks += expected.length;
          if (actual.length !== expected.length) {
            different.push(
              `${route}: ${String(expected.length)} blocks in source, ${String(actual.length)} rendered`,
            );
            continue;
          }
          expected.forEach((block, index) => {
            if (block !== actual[index]) different.push(`${route}: block ${String(index + 1)}`);
          });
        }
      }

      expect(blocks, 'the extractor has stopped finding blocks').toBeGreaterThan(1300);
      expect(different).toEqual([]);
    });
  }
});
