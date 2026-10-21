import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOOTER_ROUTES, REPOSITORY_URL } from '#docs/nav.ts';
import { PAGES_BASE } from '#docs/site.config.ts';
import {
  distDir,
  docsBase,
  fileOf,
  htmlFiles,
  load,
  routeOf,
  type Target,
} from '#docs/tests/support/dist.ts';

const BASES: Record<Target, string> = { pages: PAGES_BASE, image: '/docs/' };

for (const target of ['pages', 'image'] as const) {
  describe(`the footer of the ${target} build`, () => {
    const dir = distDir(target);
    const base = BASES[target];
    const home = load(path.join(dir, 'index.html'));

    it('is on every page that has a layout, not only the home page', () => {
      const missing = htmlFiles(dir)
        .filter((file) => !file.endsWith('404.html'))
        .filter((file) => load(file)('footer.footer').length !== 1)
        .map((file) => path.relative(dir, file));
      expect(missing).toEqual([]);
    });

    it('states the licence and the year the site was built', () => {
      expect(home('footer .footer__copyright').text()).toBe(
        `© ${String(new Date().getUTCFullYear())} Odudu · AGPL-3.0`,
      );
    });

    it('links the chosen sections and the repository, and each section exists in the build', () => {
      const links = home('footer a').toArray();
      const hrefs = links.map((link) => home(link).attr('href'));
      expect(hrefs).toEqual([
        ...FOOTER_ROUTES.map((route) => `${docsBase(target)}${route}`),
        REPOSITORY_URL,
      ]);
      for (const route of FOOTER_ROUTES) {
        const file = fileOf(dir, base, `${docsBase(target)}${route}`);
        expect(file !== null && existsSync(file), route).toBe(true);
      }
    });

    it('opens the repository in a new tab, safely, and says so to a screen reader', () => {
      const github = home(`footer a[href="${REPOSITORY_URL}"]`);
      expect(github.attr('target')).toBe('_blank');
      expect(new Set((github.attr('rel') ?? '').split(/\s+/u))).toEqual(
        new Set(['noopener', 'noreferrer']),
      );
      expect(github.text()).toBe('GitHub (opens in a new tab)');
    });

    it('carries no style attribute, which the image policy would have to hash', () => {
      for (const file of htmlFiles(dir)) {
        const $ = load(file);
        expect(
          $('footer, footer *').filter((_, element) => $(element).attr('style') !== undefined),
          routeOf(dir, file, base),
        ).toHaveLength(0);
      }
    });
  });
}

describe('the footer of the image build', () => {
  it('names no address of the hosted site', () => {
    const $ = load(path.join(distDir('image'), 'index.html'));
    expect($('footer').html() ?? '').not.toContain('/odudu/');
  });
});
