import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '#docs/nav.ts';
import { IMAGE_BASE, PAGES_BASE, PAGES_DOCS_BASE } from '#docs/site.config.ts';
import { distDir, htmlFiles, load, routeOf, walk, type Target } from '#docs/tests/support/dist.ts';

function routes(target: Target, base: string): string[] {
  const dir = distDir(target);
  return htmlFiles(dir).map((file) => routeOf(dir, file, base));
}

// Pages that are not documentation: the landing, the not-found page and the search results.
function isDocumentation(route: string, base: string): boolean {
  const rest = route.slice(base.length);
  return rest !== '' && rest !== '404.html' && rest !== 'search/';
}

describe('where the documentation lives', () => {
  it('puts every documentation page of the Pages build under the docs directory', () => {
    const outside = routes('pages', PAGES_BASE).filter(
      (route) =>
        isDocumentation(route, PAGES_BASE) &&
        !route.startsWith(PAGES_DOCS_BASE) &&
        !route.startsWith(`${PAGES_BASE}docs`),
    );
    expect(outside).toEqual([]);
  });

  it('has the landing at the site root and the docs home at the docs directory', () => {
    const dir = distDir('pages');
    expect(load(path.join(dir, 'index.html'))('[data-page="landing"]')).toHaveLength(1);
    expect(load(path.join(dir, 'docs/index.html'))('[data-page="docs-home"]')).toHaveLength(1);
  });

  it('serves the same pages at the same place under the docs directory in both builds', () => {
    const pages = routes('pages', PAGES_BASE)
      .filter((route) => route.startsWith(PAGES_DOCS_BASE))
      .map((route) => route.slice(PAGES_DOCS_BASE.length));
    const image = routes('image', IMAGE_BASE).map((route) => route.slice(IMAGE_BASE.length));
    const documents = (list: string[]): string[] =>
      list.filter((route) => route !== '404.html' && route !== 'search/').sort();
    expect(documents(pages)).toEqual(documents(image));
    for (const section of SECTIONS) expect(pages).toContain(section.route);
  });

  it('holds nothing outside the docs directory but the landing and what it and the crawlers need', () => {
    const dir = distDir('pages');
    const allowed = [
      /^index\.html$/u,
      /^404\.html$/u,
      /^search\/index\.html$/u,
      /^search-index\.json$/u,
      /^sitemap\.xml$/u,
      /^robots\.txt$/u,
      /^llms(?:-full)?\.txt$/u,
      /^assets\//u,
      /^brand\//u,
      /^console\//u,
      /^licenses\//u,
      /^openapi\//u,
      /^docs\//u,
    ];
    const stray = walk(dir)
      .map((file) => path.relative(dir, file).split(path.sep).join('/'))
      .filter((file) => !allowed.some((pattern) => pattern.test(file)));
    expect(stray).toEqual([]);
  });

  it('writes the Markdown copies beside the pages they copy', () => {
    const dir = distDir('pages');
    const copies = walk(path.join(dir, 'docs'))
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.relative(dir, file).split(path.sep).join('/'));
    expect(copies.length).toBeGreaterThan(SECTIONS.length);
    const top = walk(dir)
      .map((file) => path.relative(dir, file).split(path.sep).join('/'))
      .filter((file) => file.endsWith('.md') && !file.startsWith('docs/'));
    expect(top).toEqual([]);
  });

  it('keeps llms.txt at the site root, listing addresses under the docs directory', () => {
    const text = readFileSync(path.join(distDir('pages'), 'llms.txt'), 'utf8');
    const listed = [...text.matchAll(/\]\((\S+?\.md)\)/gu)].map((match) => match[1] ?? '');
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.filter((url) => !new URL(url).pathname.startsWith(PAGES_DOCS_BASE))).toEqual([]);
  });
});
