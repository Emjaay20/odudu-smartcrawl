import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { expectLandingNodes, jsonLdNodes, type JsonLdNode } from '#docs/tests/support/jsonld.ts';
import { SECTIONS } from '#docs/nav.ts';
import { PAGES_BASE, SITE_ORIGIN } from '#docs/site.config.ts';
import {
  DOCS_ROOT,
  distDir,
  htmlFiles,
  isDocumentRoute,
  load,
  routeOf,
  walk,
} from '#docs/tests/support/dist.ts';

const BASE = PAGES_BASE;

interface Page {
  file: string;
  route: string;
  name: string;
  $: cheerio.CheerioAPI;
}

function pages(): Page[] {
  const dir = distDir('pages');
  return htmlFiles(dir)
    .map((file) => ({
      file,
      route: routeOf(dir, file, BASE),
      name: path.relative(dir, file),
      $: load(file),
    }))
    .filter((page) => isDocumentRoute(page.route, BASE));
}

// Every page that breaks the rule, named by file; an empty list is a pass.
function violations(rule: (page: Page) => string | null): string[] {
  return pages().flatMap((page) => {
    const message = rule(page);
    return message === null ? [] : [`${page.name}: ${message}`];
  });
}

function meta(page: Page, key: 'name' | 'property', value: string): string[] {
  return page
    .$(`head meta[${key}="${value}"]`)
    .map((_, element) => page.$(element).attr('content') ?? '')
    .get();
}

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function jsonLd(page: Page): JsonLdNode[] {
  return jsonLdNodes(
    page
      .$('script[type="application/ld+json"]')
      .toArray()
      .map((element) => page.$(element).text()),
  );
}

// A stub page waits for its increment: its word floor applies once it is filled.
const UNFILLED = new Set(
  JSON.parse(readFileSync(path.join(DOCS_ROOT, 'tests/unfilled.json'), 'utf8')) as string[],
);

describe('the Pages build is indexable HTML', () => {
  it('has pages to check', () => {
    expect(pages().map((page) => page.route)).toContain(BASE);
    expect(pages().length).toBeGreaterThanOrEqual(SECTIONS.length + 1);
  });

  it('declares the page language on <html lang> and agrees with the locale it was built for', () => {
    expect(
      violations((page) => {
        const locale = meta(page, 'name', 'docusaurus_locale')[0];
        const lang = page.$('html').attr('lang');
        return lang === 'en' && lang === locale
          ? null
          : `lang=${String(lang)} locale=${String(locale)}`;
      }),
    ).toEqual([]);
  });

  it('has exactly one title of at most 70 characters, unique across pages', () => {
    expect(
      violations((page) => {
        const titles = page.$('head title');
        const text = titles.text();
        if (titles.length !== 1) return `${String(titles.length)} titles`;
        return text.length > 0 && text.length <= 70
          ? null
          : `title of ${String(text.length)} characters`;
      }),
    ).toEqual([]);
    expect(duplicates(pages().map((page) => page.$('head title').text()))).toEqual([]);
  });

  it('has exactly one description of 50 to 160 characters, unique across pages', () => {
    expect(
      violations((page) => {
        const found = meta(page, 'name', 'description');
        if (found.length !== 1) return `${String(found.length)} descriptions`;
        const length = (found[0] ?? '').length;
        return length >= 50 && length <= 160 ? null : `description of ${String(length)} characters`;
      }),
    ).toEqual([]);
    expect(duplicates(pages().map((page) => meta(page, 'name', 'description')[0] ?? ''))).toEqual(
      [],
    );
  });

  it('has exactly one absolute canonical equal to site, base and route, and og:url the same', () => {
    expect(
      violations((page) => {
        const found = page
          .$('head link[rel="canonical"]')
          .map((_, element) => page.$(element).attr('href') ?? '')
          .get();
        const expected = `${SITE_ORIGIN}${page.route}`;
        const ogUrl = meta(page, 'property', 'og:url');
        if (found.length !== 1 || found[0] !== expected) return `canonical ${found.join(',')}`;
        return ogUrl.length === 1 && ogUrl[0] === expected ? null : `og:url ${ogUrl.join(',')}`;
      }),
    ).toEqual([]);
  });

  it('carries the Open Graph and Twitter tags with the social image as an absolute address', () => {
    const image = `${SITE_ORIGIN}${BASE}brand/social.png`;
    expect(
      violations((page) => {
        const missing = [
          ['property', 'og:title'],
          ['property', 'og:description'],
          ['property', 'og:type'],
          ['property', 'og:site_name'],
          ['property', 'og:locale'],
          ['name', 'twitter:card'],
        ].filter(
          ([key, value]) => meta(page, key as 'name' | 'property', value ?? '').length !== 1,
        );
        const images = [
          meta(page, 'property', 'og:image')[0],
          meta(page, 'name', 'twitter:image')[0],
        ];
        if (images.some((found) => found !== image)) return `images ${images.join(',')}`;
        const card = meta(page, 'name', 'twitter:card')[0];
        if (card !== 'summary_large_image') return `twitter:card ${String(card)}`;
        return missing.length === 0 ? null : `missing ${missing.map((pair) => pair[1]).join(',')}`;
      }),
    ).toEqual([]);
    expect(existsSync(path.join(distDir('pages'), 'brand/social.png'))).toBe(true);
  });

  it('names the page and the default as its only alternates while English is the only language', () => {
    expect(
      violations((page) => {
        const alternates = page
          .$('head link[rel="alternate"][hreflang]')
          .map((_, element) => page.$(element).attr('hreflang') ?? '')
          .get();
        const wanted = ['en', 'x-default'];
        return alternates.length === wanted.length &&
          wanted.every((tag) => alternates.includes(tag))
          ? null
          : `hreflang ${alternates.join(',')}`;
      }),
    ).toEqual([]);
  });

  it('has exactly one <h1> and at least 80 words of text that needs no script', () => {
    expect(
      violations((page) => {
        const h1 = page.$('body h1').length;
        if (h1 !== 1) return `${String(h1)} h1 elements`;
        const body = page.$('body').clone();
        body.find('script, style, noscript').remove();
        const words = body
          .text()
          .split(/\s+/u)
          .filter((word) => word !== '').length;
        if (UNFILLED.has(page.name.replace(/\.html$/u, '.md'))) return null;
        return words >= 80 ? null : `${String(words)} words`;
      }),
    ).toEqual([]);
  });

  it('links every section as an <a href> in the markup, and every sidebar entry on docs pages', () => {
    expect(
      violations((page) => {
        const hrefs = new Set(
          page
            .$('a[href]')
            .map((_, element) => page.$(element).attr('href'))
            .get(),
        );
        const absent = SECTIONS.map((section) => `${BASE}${section.route}`).filter(
          (route) => !hrefs.has(route),
        );
        return absent.length === 0 ? null : `no link to ${absent.join(', ')}`;
      }),
    ).toEqual([]);
    const docs = pages().filter((page) => page.$('[data-page]').length === 0);
    expect(docs.length).toBeGreaterThan(0);
    expect(
      docs
        .filter((page) => page.$('.theme-doc-sidebar-container .menu a[href]').length === 0)
        .map((page) => page.name),
    ).toEqual([]);
  });

  it('describes the landing page as free software by an organisation, and offers nothing', () => {
    const landing = pages().find((page) => page.route === BASE);
    if (landing === undefined) throw new Error('the landing page was not built');
    expectLandingNodes(jsonLd(landing), `${SITE_ORIGIN}${BASE}`);
  });

  it('gives every docs page a breadcrumb that ends at its own heading, with absolute addresses', () => {
    const docs = pages().filter((page) => page.$('[data-page="landing"]').length === 0);
    expect(
      docs.flatMap((page) => {
        const lists = jsonLd(page).filter((node) => node['@type'] === 'BreadcrumbList') as {
          itemListElement?: unknown;
        }[];
        const items = (lists[0]?.itemListElement ?? []) as { item: string; name: string }[];
        const last = items[items.length - 1];
        const ok =
          lists.length === 1 &&
          items.length > 0 &&
          items.every((item) => item.item.startsWith(`${SITE_ORIGIN}${BASE}`)) &&
          last?.name === page.$('body h1').first().text();
        return ok ? [] : [page.name];
      }),
    ).toEqual([]);
  });

  it('lists every built route once in the sitemap, absolute, and no 404 and no search page', () => {
    const xml = cheerio.load(readFileSync(path.join(distDir('pages'), 'sitemap.xml'), 'utf8'), {
      xmlMode: true,
    });
    const locs = xml('url > loc')
      .map((_, element) => xml(element).text())
      .get();
    expect(duplicates(locs)).toEqual([]);
    expect([...locs].sort()).toEqual(
      pages()
        .map((page) => `${SITE_ORIGIN}${page.route}`)
        .sort(),
    );
    const excluded = ['404.html', 'search/'].map((route) => `${SITE_ORIGIN}${BASE}${route}`);
    expect(locs.filter((loc) => excluded.includes(loc))).toEqual([]);
  });

  it('says nothing to keep a page out of an index', () => {
    expect(
      violations((page) => {
        const robots = meta(page, 'name', 'robots');
        return robots.length === 0 ? null : `robots ${robots.join(',')}`;
      }),
    ).toEqual([]);
  });

  it('points robots.txt at the sitemap and disallows nothing', () => {
    const robots = readFileSync(path.join(distDir('pages'), 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}${BASE}sitemap.xml`);
    expect(robots).not.toMatch(/^Disallow:\s*\S/mu);
  });

  it('offers the icon file, then the SVG icon marked any, then the touch icon', () => {
    expect(
      violations((page) => {
        const icons = page
          .$('head link[rel~="icon"], head link[rel="apple-touch-icon"]')
          .map((_, element) => {
            const link = page.$(element);
            return [
              link.attr('rel'),
              link.attr('href'),
              link.attr('type') ?? '',
              link.attr('sizes') ?? '',
            ].join(' ');
          })
          .get();
        const expected = [
          `icon ${BASE}brand/favicon.ico  48x48`,
          `icon ${BASE}brand/favicon.svg image/svg+xml any`,
          `apple-touch-icon ${BASE}brand/apple-touch-icon.png  `,
        ];
        return JSON.stringify(icons) === JSON.stringify(expected) ? null : JSON.stringify(icons);
      }),
    ).toEqual([]);
  });

  it('gives every image alt text and a size', () => {
    expect(
      violations((page) => {
        const bare = page
          .$('img')
          .filter((_, element) => {
            const image = page.$(element);
            return (
              image.attr('alt') === undefined ||
              image.attr('width') === undefined ||
              image.attr('height') === undefined
            );
          })
          .map((_, element) => page.$(element).attr('src') ?? '')
          .get();
        return bare.length === 0 ? null : `img without alt, width or height: ${bare.join(', ')}`;
      }),
    ).toEqual([]);
  });

  it('declares font-display and a same-origin source on every @font-face', () => {
    const css = walk(path.join(distDir('pages'), 'assets/css'))
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    // A face that names only installed fonts is a metric-matched fallback: it
    // fetches nothing, so it has no source to check and no swap to time.
    const faces = (css.match(/@font-face\{[^}]*\}/gu) ?? []).filter((face) =>
      face.includes('url('),
    );
    expect(faces.length).toBeGreaterThan(0);
    const bad = faces.filter((face) => {
      const sources = [...face.matchAll(/url\(([^)]*)\)/gu)].map((match) => match[1] ?? '');
      return (
        !/font-display:\s*(?:swap|optional|fallback)/u.test(face) ||
        sources.length === 0 ||
        sources.some((source) => !source.startsWith(BASE))
      );
    });
    expect(bad).toEqual([]);
  });

  it('loads nothing from another origin: no link, script, image or CSS url()', () => {
    const own = new URL(SITE_ORIGIN).host;
    const foreign = (value: string): boolean => {
      if (!/^(?:https?:)?\/\//iu.test(value)) return false;
      return new URL(value, 'https://placeholder.invalid').host !== own;
    };
    const named = pages().flatMap((page) => {
      const found: string[] = [];
      for (const [selector, attribute] of [
        ['link[href]', 'href'],
        ['script[src]', 'src'],
        ['img[src]', 'src'],
      ] as const) {
        page.$(selector).each((_, element) => {
          const value = page.$(element).attr(attribute) ?? '';
          if (foreign(value)) found.push(`${page.name}: ${selector} ${value}`);
        });
      }
      return found;
    });
    const css = walk(path.join(distDir('pages'), 'assets/css'))
      .filter((file) => file.endsWith('.css'))
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/url\(['"]?([^'")]*)/gu)]
          .map((match) => match[1] ?? '')
          .filter((value) => foreign(value) && !value.startsWith('data:'))
          .map((value) => `${path.basename(file)}: url(${value})`),
      );
    expect([...named, ...css]).toEqual([]);
  });
});

describe('the image build is private to the installation', () => {
  const dir = (): string => distDir('image');

  it('says noindex on every page and none of the public signals', () => {
    const bad = htmlFiles(dir()).flatMap((file) => {
      const $ = load(file);
      const name = path.relative(dir(), file);
      const robots = $('meta[name="robots"][content="noindex"]').length;
      const signals = $(
        'link[rel="canonical"], link[rel="alternate"], meta[property="og:url"], script[type="application/ld+json"]',
      ).length;
      return robots === 1 && signals === 0
        ? []
        : [`${name}: noindex=${String(robots)} signals=${String(signals)}`];
    });
    expect(bad).toEqual([]);
  });

  it('has no sitemap and a robots.txt that disallows everything', () => {
    expect(existsSync(path.join(dir(), 'sitemap.xml'))).toBe(false);
    expect(readFileSync(path.join(dir(), 'robots.txt'), 'utf8')).toMatch(
      /^User-agent: \*\nDisallow: \/\n$/u,
    );
  });
});
