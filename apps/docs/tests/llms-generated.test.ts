import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PAGES_BASE, SITE_ORIGIN } from '#docs/site.config.ts';
import { buildSite } from '#docs/tests/support/build.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';
import { CONTENT_DIR, entriesOf } from '#docs/tests/support/llms.ts';

const EXAMPLE = `---
title: Example
description: A generated page.
---

# Example

See [the intro](../../introduction/index.md), [a section](/quick-start/), [here](#here), [out](https://example.com/x), [next](./other.md#there) and ![icon](/brand/favicon.svg).

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

  it('is listed with the others and has a copy, with no registration', () => {
    const urls = entriesOf(read(pagesOut, 'llms.txt')).map((entry) => entry.url);
    expect(urls).toContain(`${site}reference/generated/example.md`);
    expect(urls).toContain(`${site}reference/generated/other.md`);
    const imageUrls = entriesOf(read(imageOut, 'llms.txt')).map((entry) => entry.url);
    expect(imageUrls).toContain('/docs/reference/generated/example.md');
  });

  it('has its links resolved under the Pages base, in its copy and in llms-full.txt', () => {
    const expected = [
      `[the intro](${site}introduction/)`,
      `[a section](${site}quick-start/)`,
      '[here](#here)',
      '[out](https://example.com/x)',
      `[next](${site}reference/generated/other/#there)`,
      `![icon](${site}brand/favicon.svg)`,
      '[left alone](/quick-start/)',
    ];
    const copy = read(pagesOut, 'reference/generated/example.md');
    const full = read(pagesOut, 'llms-full.txt');
    for (const link of expected) {
      expect(copy).toContain(link);
      expect(full).toContain(link);
    }
    expect(full).toContain(`[the example](${site}reference/generated/example/)`);
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
});
