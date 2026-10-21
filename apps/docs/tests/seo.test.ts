import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { iconTags, landingJsonLd, siteHeadTags, stripForImage } from '#docs/seo.ts';
import {
  codeFrontMatter,
  missingDescriptions,
  requireDescriptions,
} from '#docs/plugins/descriptions.ts';
import { expectLandingNodes, jsonLdNodes } from '#docs/tests/support/jsonld.ts';
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

describe('the icon tags', () => {
  it('offer the icon file and the touch icon under the site base, with no address', () => {
    const tags = iconTags('/docs/');
    expect(tags).toEqual([
      {
        tagName: 'link',
        attributes: { rel: 'icon', href: '/docs/brand/favicon.ico', sizes: '48x48' },
      },
      {
        tagName: 'link',
        attributes: { rel: 'apple-touch-icon', href: '/docs/brand/apple-touch-icon.png' },
      },
    ]);
    expect(JSON.stringify(iconTags('/odudu/'))).toContain('/odudu/brand/favicon.ico');
    expect(JSON.stringify(tags)).not.toMatch(/https?:/u);
  });
});

describe('the landing page structured data', () => {
  it('describes free software and an organisation, and offers nothing for sale', () => {
    const nodes = jsonLdNodes([landingJsonLd('https://docs.test/base/')]);
    expect(nodes.map((node) => node['@type'])).toEqual(['SoftwareApplication', 'Organization']);
    expectLandingNodes(nodes, 'https://docs.test/base/');
  });

  it('escapes the characters that would close a script element', () => {
    const text = landingJsonLd('https://docs.test/</script><script>alert(1)</script>/');
    expect(text).not.toContain('<');
    expect(JSON.stringify(jsonLdNodes([landingJsonLd('https://docs.test/</script>/')]))).toContain(
      '</script>',
    );
  });
});

describe('stripping the public signals for the private image', () => {
  const head = [
    '<link data-rh=true rel=canonical href=https://a.test/x/ />',
    '<link data-rh="true" rel="alternate" href="https://a.test/x/" hreflang="en"/>',
    '<link data-rh=true rel=alternate href=https://a.test/x/ hreflang=x-default />',
    '<link rel="alternate stylesheet" href="/a-alt.css">',
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
    '<link rel=canonicalised href=/kept-a />',
    '<link data-rel=canonical href=/kept-b />',
    '<link rel="preload canonicals" href="/kept-c">',
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
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
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
      'g.md': '---\ndescription: ""\n---\n\n# G\n',
      'h.md': "---\ndescription: ''\n---\n\n# H\n",
      'i.md': '---\ndescription: "   "\n---\n\n# I\n',
      '_ignored.md': '# Docusaurus ignores a file that starts with an underscore\n',
      '_dir/j.md': '# Nor a directory\n',
      'notes.txt': 'not a page',
    });
    expect(missingDescriptions(dir)).toEqual([
      'b/index.md',
      'c.mdx',
      'd.md',
      'g.md',
      'h.md',
      'i.md',
    ]);
  });

  it('refuses front matter in a language that runs code', () => {
    const dir = content({
      'a.md': '---\ndescription: Fine.\n---\n',
      'js.md': '---js\n{ description: "evaluated" }\n---\n',
      'javascript.md': '---javascript\n{ description: "evaluated" }\n---\n',
      'json.md': '---json\n{ "description": "x" }\n---\n',
      'sub/toml.md': '---toml\ndescription = "x"\n---\n',
    });
    expect(codeFrontMatter(dir)).toEqual(['javascript.md', 'js.md', 'json.md', 'sub/toml.md']);
    expect(() => {
      requireDescriptions(dir);
    }).toThrow(/front matter that is not plain YAML.*js\.md/su);
  });

  it('throws naming the pages, and is silent when every page has one', () => {
    const bad = content({ 'x.md': '---\ntitle: X\n---\n' });
    expect(() => {
      requireDescriptions(bad);
    }).toThrow(/x\.md/u);
    const good = content({ 'x.md': '---\ndescription: Here.\n---\n' });
    expect(() => {
      requireDescriptions(good);
    }).not.toThrow();
  });

  it('holds for every page of the documentation', () => {
    expect(missingDescriptions(path.join(DOCS_ROOT, 'content/en'))).toEqual([]);
  });
});
