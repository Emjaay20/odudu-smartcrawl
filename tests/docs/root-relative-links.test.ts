import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A Markdown link written `](/guides/)` is resolved against the site's base and
// nothing else, so it misses the page whenever the documentation is served
// from a directory of its own (`docs/` on the public site). A page links to
// another by its file, `](../guides/index.md)`, which every build resolves.
// Allowed: the files the build copies to the site root. Not seen: a link built
// in JSX or a link written as a bare URL; the page-level link check in
// apps/docs/tests/links.test.ts covers what the build wrote.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SITE_FILES = /^\/(?:brand|console|openapi)\//u;
const INLINE = /\]\((<)?(\/[^)\s>]*)/gu;
const DEFINITION = /^\s{0,3}\[[^\]\n]+\]:\s*<?(\/[^\s>]*)/u;
const HTML = /\s(?:href|src)=["'](\/[^"']*)["']/giu;
const FENCE = /^\s*(`{3,}|~{3,})/u;
const CODE_SPAN = /`+[^`]*`+/gu;

export function rootRelativeLinks(markdown: string): { line: number; target: string }[] {
  const found: { line: number; target: string }[] = [];
  let fence: string | null = null;
  markdown.split('\n').forEach((raw, index) => {
    const marker = FENCE.exec(raw)?.[1];
    if (fence !== null) {
      if (marker?.startsWith(fence.charAt(0)) === true && marker.length >= fence.length) {
        fence = null;
      }
      return;
    }
    if (marker !== undefined) {
      fence = marker;
      return;
    }
    const text = raw.replace(CODE_SPAN, '');
    const targets = [
      ...[...text.matchAll(INLINE)].map((match) => match[2] ?? ''),
      ...[...text.matchAll(HTML)].map((match) => match[1] ?? ''),
      ...(DEFINITION.exec(text)?.[1] === undefined ? [] : [DEFINITION.exec(text)?.[1] ?? '']),
    ];
    for (const target of targets) {
      if (!target.startsWith('//') && !SITE_FILES.test(target)) {
        found.push({ line: index + 1, target });
      }
    }
  });
  return found;
}

describe('root-relative links in the documentation content', () => {
  it('finds a link, a reference definition and a raw anchor', () => {
    const text = [
      'See [a](/quick-start/) and [b](</guides/>).',
      '[ref]: /concepts/ "Concepts"',
      '<a href="/security/">s</a> <img src="/brand/x.svg">',
    ].join('\n');
    expect(rootRelativeLinks(text)).toEqual([
      { line: 1, target: '/quick-start/' },
      { line: 1, target: '/guides/' },
      { line: 2, target: '/concepts/' },
      { line: 3, target: '/security/' },
    ]);
  });

  it('leaves a file link, another host, a site file, code and a fence alone', () => {
    const text = [
      '[a](../guides/index.md) [b](https://example.com/x) [c](//cdn.test/x) [d](#top)',
      '[e](/openapi/admin.json) `[f](/x/)`',
      '```md',
      '[g](/x/)',
      '```',
    ].join('\n');
    expect(rootRelativeLinks(text)).toEqual([]);
  });

  it('is clean for every page', () => {
    const pages = globSync('apps/docs/content/**/*.{md,mdx}', { cwd: REPO_ROOT });
    expect(pages.length).toBeGreaterThan(50);
    const found = pages.flatMap((page) =>
      rootRelativeLinks(readFileSync(path.join(REPO_ROOT, page), 'utf8')).map(
        ({ line, target }) => `${page}:${String(line)} ${target}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
