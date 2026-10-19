import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MACHINE_READABLE_REFERENCES } from '#docs/nav.ts';
import { PAGES_BASE, SITE_ORIGIN } from '#docs/site.config.ts';
import {
  distDir,
  htmlFiles,
  isDocumentRoute,
  load,
  routeOf,
  walk,
  type Target,
} from '#docs/tests/support/dist.ts';
import {
  CONTENT_DIR,
  IMAGE_BASE,
  addressPrefix,
  copyPath,
  entriesOf,
  normalised,
  readSource,
  routeOfCopy,
  sourceOf,
} from '#docs/tests/support/llms.ts';
import { shapeOf, unresolved } from '#docs/tests/support/links.ts';

const TARGETS: Target[] = ['pages', 'image'];

function baseOf(target: Target): string {
  return target === 'pages' ? PAGES_BASE : IMAGE_BASE;
}

function read(target: Target, file: string): string {
  return readFileSync(path.join(distDir(target), file), 'utf8');
}

// Every documentation page of the build; the landing and the image's home are not documents.
function documentRoutes(target: Target): string[] {
  const dir = distDir(target);
  const base = baseOf(target);
  return htmlFiles(dir)
    .map((file) => routeOf(dir, file, base))
    .filter((route) => isDocumentRoute(route, base) && route !== base)
    .map((route) => route.slice(base.length - 1));
}

describe.each(TARGETS)('the agent copies of the %s build', (target) => {
  const entries = entriesOf(read(target, 'llms.txt'));

  it('lists every page in llms.txt, once', () => {
    const listed = entries.map((entry) => routeOfCopy(entry, target));
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(documentRoutes(target).sort());
  });

  it('has a Markdown file at every listed URL, matching its source', () => {
    const wrong: string[] = [];
    for (const entry of entries) {
      const copy = copyPath(entry, target);
      const source = sourceOf(CONTENT_DIR, copy);
      if (source === null) {
        wrong.push(`${copy}: no source page`);
        continue;
      }
      const written = readFileSync(path.join(distDir(target), copy), 'utf8');
      const copyShape = shapeOf(normalised(written, entry.description));
      const sourceShape = shapeOf(normalised(readSource(CONTENT_DIR, source), entry.description));
      if (copyShape.join('\n') !== sourceShape.join('\n')) wrong.push(copy);
      if (written.startsWith('---')) wrong.push(`${copy}: keeps its front matter`);
    }
    expect(wrong).toEqual([]);
  });

  it('lists each machine-readable reference the build is told to write', () => {
    const listed = new Set(entriesOf(read(target, 'llms.txt')).map((entry) => entry.url));
    const missing = MACHINE_READABLE_REFERENCES.filter(
      (reference) => !listed.has(`${addressPrefix(target)}${reference.file}`),
    );
    expect(missing).toEqual([]);
  });

  it('points every link of every copy at something the build wrote', () => {
    const prefix = addressPrefix(target);
    const dir = distDir(target);
    const files = ['llms.txt', 'llms-full.txt', ...entries.map((entry) => copyPath(entry, target))];
    const stray = files.flatMap((file) =>
      unresolved(read(target, file), dir, prefix).map((address) => `${file}: ${address}`),
    );
    expect(stray).toEqual([]);
  });

  it('serves nothing the build did not write', () => {
    const dir = distDir(target);
    const written = walk(dir)
      .map((file) => path.relative(dir, file).split(path.sep).join('/'))
      .filter((file) => /\.(?:md|txt)$/u.test(file))
      .sort();
    const accounted = [
      'llms.txt',
      'llms-full.txt',
      'robots.txt',
      ...entries.map((entry) => copyPath(entry, target)),
      ...MACHINE_READABLE_REFERENCES.map((reference) => reference.file).filter((file) =>
        /\.(?:md|txt)$/u.test(file),
      ),
    ].sort();
    expect(written).toEqual(accounted);
  });
});

describe('the Pages build', () => {
  it('uses absolute links from the one site address', () => {
    const wrong = entriesOf(read('pages', 'llms.txt')).filter(
      (entry) => !entry.url.startsWith(`${SITE_ORIGIN}${PAGES_BASE}`),
    );
    expect(wrong).toEqual([]);
  });

  it('is same-origin only in llms.txt', () => {
    const hosts = [...read('pages', 'llms.txt').matchAll(/https?:\/\/([^/\s)]+)/gu)].map(
      (match) => match[1],
    );
    expect(new Set(hosts)).toEqual(new Set([new URL(SITE_ORIGIN).host]));
  });
});

describe('the image build', () => {
  it('uses origin-relative links and names no host', () => {
    const text = read('image', 'llms.txt');
    expect(entriesOf(text).filter((entry) => !entry.url.startsWith(IMAGE_BASE))).toEqual([]);
    expect(text).not.toMatch(/https?:\/\//u);
    expect(text).not.toContain(new URL(SITE_ORIGIN).host);
    expect(read('image', 'llms-full.txt')).not.toContain(new URL(SITE_ORIGIN).host);
  });

  it('keeps the copies under the signals that keep the image out of search', () => {
    expect(read('image', 'robots.txt')).toContain('Disallow: /');
    const indexable = htmlFiles(distDir('image')).filter(
      (file) => !load(file)('meta[name="robots"][content~="noindex"]').length,
    );
    expect(indexable).toEqual([]);
  });
});

describe('the documentation sources', () => {
  it('has no .mdx page, whose Markdown copy would keep its imports and lose its components', () => {
    expect(walk(CONTENT_DIR).filter((file) => file.endsWith('.mdx'))).toEqual([]);
  });
});
