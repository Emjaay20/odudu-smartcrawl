import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGES_BASE, PAGES_DOCS_BASE } from '#docs/site.config.ts';
import { distDir, load } from '#docs/tests/support/dist.ts';

// The page GitHub Pages serves for any address it has no file for, and the one
// the server serves under /docs/ for a path the documentation lacks.
describe('the built 404 page', () => {
  for (const target of ['pages', 'image'] as const) {
    describe(target, () => {
      const $ = load(path.join(distDir(target), '404.html'));
      const base = target === 'pages' ? PAGES_BASE : '/docs/';
      const docs = target === 'pages' ? PAGES_DOCS_BASE : '/docs/';

      it('says the page was not found, once, under the site layout', () => {
        expect($('main[data-page="not-found"] h1').text()).toBe('Page not found');
        expect($('main')).toHaveLength(1);
        expect($('nav.navbar')).toHaveLength(1);
        expect($('footer')).toHaveLength(1);
      });

      it('carries the drawing that plays twice by itself, and no script to run it', () => {
        expect($('main svg[aria-hidden="true"]')).toHaveLength(1);
        expect($('main svg path[class*="route"]')).toHaveLength(2);
        expect($('main script')).toHaveLength(0);
      });

      it('links the documentation home, the quick start and the search', () => {
        const hrefs = $('main a')
          .map((_, link) => $(link).attr('href'))
          .get();
        expect(hrefs).toEqual([docs, `${docs}quick-start/`, `${base}search/`]);
      });

      it('keeps itself out of an index', () => {
        expect($('meta[name="robots"][content*="noindex"]').length).toBeGreaterThan(0);
        expect($('link[rel="canonical"]')).toHaveLength(0);
      });

      it('says nothing about the page that was asked for', () => {
        expect($('main').text()).not.toMatch(/404|not-found|nope/iu);
      });
    });
  }
});
