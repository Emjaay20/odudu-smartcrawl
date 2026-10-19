import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every page the server renders is one of the `*-html.ts` files under a
// package's `src/view`, and must reach Instrument by going through that
// package's shell. This reads those files; it cannot see a page built in a
// route file, or markup returned by a helper that is not a `*-html.ts`.
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const FIXTURE = join(REPO_ROOT, 'tests/lint/fixtures/renderer-without-shell');
const SHELL_IMPORT = "from '#/view/document'";
const OWN_DOCUMENT = /<html|<!doctype|<link|<style| style="/iu;
const SHELLS = ['protocol-oidc', 'account', 'authn-flows', 'console-gateway'].map((name) =>
  join(PACKAGES_DIR, name, 'src/view/document.ts'),
);

interface Renderer {
  readonly path: string;
  readonly name: string;
  readonly text: string;
}

async function renderersIn(viewDir: string): Promise<Renderer[]> {
  let entries: string[];
  try {
    entries = await readdir(viewDir);
  } catch {
    return [];
  }
  return Promise.all(
    entries
      .filter((name) => name.endsWith('-html.ts'))
      .map(async (name) => ({
        path: join(viewDir, name),
        name,
        text: await readFile(join(viewDir, name), 'utf8'),
      })),
  );
}

async function allRenderers(): Promise<Renderer[]> {
  const packages = await readdir(PACKAGES_DIR);
  return (
    await Promise.all(packages.map((name) => renderersIn(join(PACKAGES_DIR, name, 'src/view'))))
  ).flat();
}

function relative(renderer: Renderer): string {
  return renderer.path.slice(REPO_ROOT.length + 1);
}

const withoutShell = (renderers: readonly Renderer[]): string[] =>
  renderers.filter((r) => !r.text.includes(SHELL_IMPORT)).map(relative);
const ownDocument = (renderers: readonly Renderer[]): string[] =>
  renderers.filter((r) => OWN_DOCUMENT.test(r.text)).map(relative);
const withoutTest = (renderers: readonly Renderer[]): string[] =>
  renderers.filter((r) => !existsSync(r.path.replace(/\.ts$/u, '.test.ts'))).map(relative);

describe('every server page is under Instrument', () => {
  it('finds the renderers, so an empty scan cannot pass', async () => {
    expect((await allRenderers()).length).toBeGreaterThanOrEqual(15);
  });

  it("imports its package's shell in every renderer", async () => {
    expect(withoutShell(await allRenderers())).toEqual([]);
  });

  it('builds no document of its own', async () => {
    expect(ownDocument(await allRenderers())).toEqual([]);
  });

  it('has a renderer test for every renderer', async () => {
    expect(withoutTest(await allRenderers())).toEqual([]);
  });

  it('fails on a fixture that builds its own document', async () => {
    const fixture = await renderersIn(FIXTURE);
    expect(fixture).toHaveLength(1);
    expect(withoutShell(fixture)).toHaveLength(1);
    expect(ownDocument(fixture)).toHaveLength(1);
    expect(withoutTest(fixture)).toHaveLength(1);
  });

  // The shell is duplicated per package on purpose, so the copies are held
  // to one shape here: what is between the import and `page` is allowed to
  // differ only in its comments.
  it('keeps the four shells to one document', async () => {
    const code = (text: string): string =>
      text
        .split('\n')
        .filter((line) => line.trim() !== '' && !/^\s*\/\//u.test(line))
        .join('\n');
    const texts = await Promise.all(SHELLS.map(async (path) => code(await readFile(path, 'utf8'))));
    for (const text of texts) expect(text).toBe(texts[0]);
  });
});
