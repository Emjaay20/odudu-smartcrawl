import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGES_BASE } from '#docs/site.config.ts';
import {
  DOCS_ROOT,
  distDir,
  fileOf,
  htmlFiles,
  internalReferences,
  load,
  routeOf,
  walk,
  type Target,
} from '#docs/tests/support/dist.ts';

const BASES: Record<Target, string> = { pages: PAGES_BASE, image: '/docs/' };

// The generated endpoints page lists the routes the server answers, and the
// documentation's own are two of them: a route in code, not a link on the site.
function isServerRouteRow(file: string, line: string): boolean {
  return (
    file.endsWith(path.join('reference', 'generated', 'endpoints.md')) &&
    /^\| `[A-Z]+` \| `\/docs\/\*` \|/u.test(line)
  );
}

// These pages record the server's own routes, `/docs/` among them, which are
// not addresses on this site; only a Markdown link in their prose is held to it.
const TRANSCRIPTS = ['reference/transcripts/'];

function isTranscript(file: string): boolean {
  const relative = path
    .relative(path.join(DOCS_ROOT, 'content/en'), file)
    .split(path.sep)
    .join('/');
  return TRANSCRIPTS.some((directory) => relative.startsWith(directory));
}

const ABSOLUTE = /(?:^|[\s"'`(=])\/(?:odudu|docs)\//u;
const ABSOLUTE_LINK = /\]\(\/(?:odudu|docs)\//u;

// 0-based indexes of the lines that name an absolute site path.
export function absolutePathLines(text: string, transcript: boolean): number[] {
  let fenced = false;
  return text.split('\n').flatMap((line, index) => {
    if (/^\s*(?:```|~~~)/u.test(line)) fenced = !fenced;
    if (!transcript) return ABSOLUTE.test(line) ? [index] : [];
    return !fenced && ABSOLUTE_LINK.test(line) ? [index] : [];
  });
}

describe('internal links', () => {
  for (const target of ['pages', 'image'] as const) {
    it(`has no internal link that resolves to nothing in the ${target} build`, () => {
      const dir = distDir(target);
      const base = BASES[target];
      const dead: string[] = [];
      for (const file of htmlFiles(dir)) {
        const route = routeOf(dir, file, base);
        for (const reference of internalReferences(load(file), route)) {
          const target = fileOf(dir, base, reference.pathname);
          if (target === null || !existsSync(target)) {
            dead.push(`${route}: ${reference.attribute}`);
          }
        }
      }
      expect(dead).toEqual([]);
    });
  }

  it('uses no absolute /odudu or /docs path in source', () => {
    const files = [
      ...walk(path.join(DOCS_ROOT, 'content/en')),
      ...walk(path.join(DOCS_ROOT, 'src')),
      path.join(DOCS_ROOT, 'nav.ts'),
      path.join(DOCS_ROOT, 'sidebars.ts'),
    ].filter((file) => /\.(?:md|mdx|tsx?|css)$/u.test(file));
    const offenders = files.flatMap((file) =>
      absolutePathLines(readFileSync(file, 'utf8'), isTranscript(file))
        .filter(
          (index) => !isServerRouteRow(file, readFileSync(file, 'utf8').split('\n')[index] ?? ''),
        )
        .map((index) => `${path.relative(DOCS_ROOT, file)}:${String(index + 1)}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('the absolute path check on a transcript page', () => {
  it('ignores a route named in a fence or in prose, and catches a link', () => {
    const text =
      'The route is `/docs/` and /docs/ again.\n```\nGET /docs/\n```\nSee [x](/docs/y/).';
    expect(absolutePathLines(text, true)).toEqual([4]);
    expect(absolutePathLines(text, false)).toEqual([0, 2, 4]);
  });
});
