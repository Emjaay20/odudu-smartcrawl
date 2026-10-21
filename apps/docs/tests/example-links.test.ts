import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const PAGES = globSync('apps/docs/content/**/*.{md,mdx}', { cwd: REPO_ROOT });
const EXAMPLE_LINK = /github\.com\/wizzywit\/odudu\/tree\/main\/(examples\/[\w-]+)/gu;

function repoPath(relative: string): string {
  return path.join(REPO_ROOT, relative);
}

describe('links from the documentation to the examples', () => {
  const linked = PAGES.flatMap((page) =>
    [...readFileSync(repoPath(page), 'utf8').matchAll(EXAMPLE_LINK)].map((match) => ({
      page,
      directory: match[1] ?? '',
    })),
  );

  it('is made by the integration guides', () => {
    expect(new Set(linked.map(({ directory }) => directory))).toEqual(
      new Set(['examples/web-app', 'examples/api', 'examples/machine-to-machine']),
    );
  });

  it.each(linked.map(({ page, directory }) => [page, directory] as const))(
    '%s links %s, which exists with a README, a manifest and a test',
    (_page, directory) => {
      expect(existsSync(repoPath(`${directory}/README.md`)), `${directory}/README.md`).toBe(true);
      expect(existsSync(repoPath(`${directory}/package.json`)), `${directory}/package.json`).toBe(
        true,
      );
      expect(existsSync(repoPath(`${directory}/test.ts`)), `${directory}/test.ts`).toBe(true);
    },
  );
});

describe('links between the examples', () => {
  const readmes = globSync('examples/**/README.md', {
    cwd: REPO_ROOT,
    exclude: (name) => name === 'node_modules',
  });

  it('finds the READMEs', () => {
    expect(readmes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(readmes)('%s links only to files and folders that exist', (readme) => {
    const text = readFileSync(repoPath(readme), 'utf8');
    const relative = [...text.matchAll(/\]\((\.{1,2}\/[^)#\s]*)\)/gu)].map((m) => m[1] ?? '');
    for (const target of relative) {
      expect(existsSync(path.resolve(path.dirname(repoPath(readme)), target)), target).toBe(true);
    }
  });
});
