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
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          /(?:^|[\s"'`(=])\/(?:odudu|docs)\//u.test(line)
            ? [`${path.relative(DOCS_ROOT, file)}:${String(index + 1)}`]
            : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
