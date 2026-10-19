import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { landingJsonLd, siteHeadTags, stripForImage } from '#docs/seo.ts';
import { missingDescriptions, requireDescriptions } from '#docs/plugins/descriptions.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

describe('the site-wide head tags', () => {
  it('name the site and its type, and carry no address', () => {
    const tags = siteHeadTags();
    expect(tags).toContainEqual({
      tagName: 'meta',
      attributes: { property: 'og:site_name', content: 'Odudu' },
    });
    expect(tags).toContainEqual({
      tagName: 'meta',
      attributes: { property: 'og:type', content: 'website' },
    });
    expect(JSON.stringify(tags)).not.toMatch(/https?:/u);
  });
});

describe('the landing page structured data', () => {
  const data = (siteUrl: string): unknown => JSON.parse(landingJsonLd(siteUrl));

  it('describes free software and an organisation, and offers nothing for sale', () => {
    const graph = (data('https://docs.test/base/') as { '@graph': Record<string, unknown>[] })[
      '@graph'
    ];
    const types = graph.map((node) => node['@type']);
    expect(types).toEqual(['SoftwareApplication', 'Organization']);
    const [software, organisation] = graph;
    expect(software).toMatchObject({
      name: 'Odudu',
      isAccessibleForFree: true,
      license: expect.stringMatching(/^https:\/\//u),
    });
    expect(software).toHaveProperty('applicationCategory');
    expect(software).toHaveProperty('operatingSystem');
    expect(software).not.toHaveProperty('offers');
    expect(organisation).toMatchObject({
      name: 'Odudu',
      url: 'https://docs.test/base/',
      logo: expect.stringMatching(/^https:\/\/docs\.test\/base\//u),
      sameAs: [expect.stringMatching(/^https:\/\/github\.com\//u)],
    });
  });

  it('escapes the characters that would close a script element', () => {
    const text = landingJsonLd('https://docs.test/</script><script>alert(1)</script>/');
    expect(text).not.toContain('<');
    expect(JSON.stringify(data('https://docs.test/</script>/'))).toContain('</script>');
  });
});

describe('stripping the public signals for the private image', () => {
  const head = [
    '<link data-rh=true rel=canonical href=https://a.test/x/ />',
    '<link data-rh="true" rel="alternate" href="https://a.test/x/" hreflang="en"/>',
    '<link data-rh=true rel=alternate href=https://a.test/x/ hreflang=x-default />',
    '<meta data-rh=true property=og:url content=https://a.test/x/ />',
    '<meta data-rh="true" property="og:url" content="https://a.test/x/"/>',
    '<script data-rh=true type=application/ld+json>{"@type":"BreadcrumbList"}</script>',
    '<script type="application/ld+json">{"@type":"X"}</script>',
  ];
  const keep = [
    '<meta name=description content="kept" />',
    '<meta property=og:title content=kept />',
    '<link rel=stylesheet href=/docs/a.css />',
    '<script src=/docs/a.js defer></script>',
    '<meta name=robots content=noindex>',
  ];

  it('removes canonical, alternate, og:url and JSON-LD, quoted or not, and nothing else', () => {
    const html = `<head>${[...head, ...keep].join('')}</head>`;
    expect(stripForImage(html)).toBe(`<head>${keep.join('')}</head>`);
  });

  it('leaves a page without the signals as it was', () => {
    const html = `<head>${keep.join('')}</head>`;
    expect(stripForImage(html)).toBe(html);
  });
});

describe('the front-matter description check', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function content(files: Record<string, string>): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'odudu-descriptions-'));
    dirs.push(dir);
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), text);
    }
    return dir;
  }

  it('names every page without a description, nested pages and .mdx included', () => {
    const dir = content({
      'a.md': '---\ntitle: A\ndescription: Present.\n---\n\n# A\n',
      'b/index.md': '---\ntitle: B\n---\n\n# B\n\nA first paragraph Docusaurus would use.\n',
      'c.mdx': '# No front matter at all\n',
      'd.md': '---\ntitle: D\ndescription:\n---\n\n# D\n',
      'e.md': '---\ndescription: >\n  Folded onto the next line.\n---\n\n# E\n',
      'f.md': '---\ndescription: "Quoted."\n---\n\n# F\n',
      'notes.txt': 'not a page',
    });
    expect(missingDescriptions(dir)).toEqual(['b/index.md', 'c.mdx', 'd.md']);
  });

  it('throws naming the pages, and is silent when every page has one', () => {
    const bad = content({ 'x.md': '---\ntitle: X\n---\n' });
    expect(() => requireDescriptions(bad)).toThrow(/x\.md/u);
    const good = content({ 'x.md': '---\ndescription: Here.\n---\n' });
    expect(() => requireDescriptions(good)).not.toThrow();
  });

  it('holds for every page of the documentation', () => {
    expect(missingDescriptions(path.join(DOCS_ROOT, 'content/en'))).toEqual([]);
  });
});
