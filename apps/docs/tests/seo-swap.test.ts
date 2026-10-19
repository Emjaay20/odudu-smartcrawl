import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from '#docs/site.config.ts';
import { DOCS_ROOT, htmlFiles, load, routeOf, walk } from '#docs/tests/support/dist.ts';

const SWAPPED_ORIGIN = 'https://example.test';
const TEXT = /\.(?:html|js|css|json|txt|xml|svg|md)$/u;

describe('moving the site to another address', () => {
  let out = '';

  beforeAll(() => {
    out = mkdtempSync(path.join(tmpdir(), 'odudu-docs-swap-'));
    const build = spawnSync(
      path.join(DOCS_ROOT, 'node_modules/.bin/docusaurus'),
      ['build', '--out-dir', out],
      {
        cwd: DOCS_ROOT,
        env: { ...process.env, DOCS_SITE_ORIGIN: SWAPPED_ORIGIN, DOCS_BASE: '/', DOCS_TARGET: '' },
        encoding: 'utf8',
      },
    );
    if (build.status !== 0) throw new Error(`build failed:\n${build.stdout}\n${build.stderr}`);
  }, 180_000);

  afterAll(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it('leaves the old address in no file of the build', () => {
    const host = new URL(SITE_ORIGIN).host;
    const named = walk(out).filter(
      (file) => TEXT.test(file) && readFileSync(file, 'utf8').includes(host),
    );
    expect(named.map((file) => path.relative(out, file))).toEqual([]);
  });

  it('writes every canonical, the sitemap and robots.txt under the new one', () => {
    const wrong: string[] = [];
    for (const file of htmlFiles(out)) {
      const route = routeOf(out, file, '/');
      if (route === '/404.html' || route === '/search/') continue;
      const canonical = load(file)('link[rel="canonical"]').attr('href');
      if (canonical !== `${SWAPPED_ORIGIN}${route}`) wrong.push(`${route}: ${String(canonical)}`);
    }
    expect(wrong).toEqual([]);
    const sitemap = cheerio.load(readFileSync(path.join(out, 'sitemap.xml'), 'utf8'), {
      xmlMode: true,
    });
    const locs = sitemap('url > loc')
      .map((_, element) => sitemap(element).text())
      .get();
    expect(locs.length).toBeGreaterThan(0);
    expect(locs.filter((loc) => !loc.startsWith(`${SWAPPED_ORIGIN}/`))).toEqual([]);
    expect(readFileSync(path.join(out, 'robots.txt'), 'utf8')).toContain(
      `Sitemap: ${SWAPPED_ORIGIN}/sitemap.xml`,
    );
  });
});
