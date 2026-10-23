import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DOCS_DIRECTORY, PAGES_BASE, SITE_ORIGIN } from '#docs/site.config.ts';
import { buildSite } from '#docs/tests/support/build.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';
import { CONTENT_DIR, docsRouteOf, entriesOf, siteAddress } from '#docs/tests/support/llms.ts';
import { referencesOf, unresolved } from '#docs/tests/support/links.ts';

const EXAMPLE = `---
title: Example
description: A generated page.
---

# Example

See [the intro](../../introduction/index.md), [a section](/), [here](#here), [out](https://example.com/x), [next](./other.md#there) and ![icon](/brand/favicon.svg).

A [reference link][ref], an autolink <https://example.com/auto>.

[ref]: ../../concepts/index.md "Concepts"

## Here

\`\`\`md
[left alone](/quick-start/)
\`\`\`
`;

const OTHER = `---
title: Other
description: Another generated page.
---

# Other

## There

Back to [the example](example.md).
`;

// Pages written by a generator land in the docs tree with the others and must need no registration.
describe('a generated page added to the documentation', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'odudu-docs-generated-'));
  // docs paths are resolved from the app directory, so the tree is kept beneath it
  const contentRelative = path.join(
    'node_modules/.cache',
    `odudu-docs-generated-${String(process.pid)}`,
  );
  const contentDir = path.join(DOCS_ROOT, contentRelative);
  const pagesOut = path.join(work, 'pages');
  const imageOut = path.join(work, 'image');

  beforeAll(async () => {
    cpSync(CONTENT_DIR, contentDir, { recursive: true });
    mkdirSync(path.join(contentDir, 'reference/generated'), { recursive: true });
    writeFileSync(path.join(contentDir, 'reference/generated/example.md'), EXAMPLE);
    writeFileSync(path.join(contentDir, 'reference/generated/other.md'), OTHER);
    await buildSite(pagesOut, { DOCS_CONTENT: contentRelative });
    await buildSite(imageOut, { DOCS_CONTENT: contentRelative, DOCS_TARGET: 'image' });
  }, 300_000);

  afterAll(() => {
    rmSync(work, { recursive: true, force: true });
    rmSync(contentDir, { recursive: true, force: true });
  });

  const read = (dir: string, file: string): string => readFileSync(path.join(dir, file), 'utf8');
  const site = `${SITE_ORIGIN}${PAGES_BASE}`;
  const docsSite = `${site}${DOCS_DIRECTORY}`;

  it('is listed with the others and has a copy, with no registration', () => {
    const urls = entriesOf(read(pagesOut, 'llms.txt')).map((entry) => entry.url);
    expect(urls).toContain(`${docsSite}reference/generated/example.md`);
    expect(urls).toContain(`${docsSite}reference/generated/other.md`);
    const imageUrls = entriesOf(read(imageOut, 'llms.txt')).map((entry) => entry.url);
    expect(imageUrls).toContain('/docs/reference/generated/example.md');
  });

  it('has its links resolved under the Pages base, in its copy and in llms-full.txt', () => {
    const expected = [
      `[the intro](${docsSite}introduction/)`,
      `[a section](${site})`,
      '[here](#here)',
      '[out](https://example.com/x)',
      `[next](${docsSite}reference/generated/other/#there)`,
      `![icon](${site}brand/favicon.svg)`,
      '[left alone](/quick-start/)',
      `[ref]: ${docsSite}concepts/ "Concepts"`,
      '<https://example.com/auto>',
    ];
    const copy = read(pagesOut, `${DOCS_DIRECTORY}reference/generated/example.md`);
    const full = read(pagesOut, 'llms-full.txt');
    for (const link of expected) {
      expect(copy).toContain(link);
      expect(full).toContain(link);
    }
    expect(full).toContain(`[the example](${docsSite}reference/generated/example/)`);
  });

  it('has its links origin-relative under the image base', () => {
    const copy = read(imageOut, 'reference/generated/example.md');
    expect(copy).toContain('[the intro](/docs/introduction/)');
    expect(copy).toContain('[next](/docs/reference/generated/other/#there)');
    expect(read(imageOut, 'llms-full.txt')).toContain(
      '[the example](/docs/reference/generated/example/)',
    );
    expect(copy).not.toContain(new URL(SITE_ORIGIN).host);
  });

  it.each([
    ['pages', 'pagesOut'],
    ['image', 'imageOut'],
  ] as const)('points every reference of the %s build at something it wrote', (target, which) => {
    const dir = which === 'pagesOut' ? pagesOut : imageOut;
    const prefix = siteAddress(target);
    const docs = docsRouteOf(target);
    const stray = [
      `${docs}reference/generated/example.md`,
      `${docs}reference/generated/other.md`,
      'llms-full.txt',
    ].flatMap((file) => unresolved(read(dir, file), dir, prefix));
    expect(stray).toEqual([]);
    const all = referencesOf(read(dir, `${docs}reference/generated/example.md`));
    expect(all.filter((address) => address.startsWith('/') && !address.startsWith(prefix))).toEqual(
      [],
    );
    expect(all.some((address) => address.endsWith('concepts/'))).toBe(true);
  });
});

// A copy is named by its page's route and mapped back to its source by file name,
// so a page whose route is not its path has no source to resolve its links against.
describe('a page whose route is not its file path', () => {
  it('fails the build, naming the copy that has no source', async () => {
    const work = mkdtempSync(path.join(tmpdir(), 'odudu-docs-slug-'));
    const relative = path.join('node_modules/.cache', `odudu-docs-slug-${String(process.pid)}`);
    const dir = path.join(DOCS_ROOT, relative);
    try {
      cpSync(CONTENT_DIR, dir, { recursive: true });
      writeFileSync(
        path.join(dir, 'reference/slugged.md'),
        '---\ntitle: Slugged\ndescription: A page with its own route.\nslug: /renamed\n---\n\n# Slugged\n',
      );
      await expect(buildSite(path.join(work, 'out'), { DOCS_CONTENT: relative })).rejects.toThrow(
        /No source page for the Markdown copy renamed\.md/u,
      );
    } finally {
      rmSync(work, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
});
