import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Every page is a `*-html.ts` under some `src/view` and must call its
// package's `page()`. Read as syntax: a comment or string naming the import
// counts for nothing, and fragments are joined so `'<' + 'html'` is `<html`.
// Not seen: a page built in a route file, markup from a helper that is not a
// `*-html.ts`, or text computed at run time. Mail templates are not pages
// (no `pageHeaders`); `packages/email/src/service/templates.test.ts` covers them.
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const APPS_DIR = join(REPO_ROOT, 'apps');
const FIXTURE = join(REPO_ROOT, 'tests/lint/fixtures/renderer-without-shell');
const SHELL_MODULE = '#/view/document';
const OWN_MARKUP =
  /<(?:html|head|body|base|meta|link|style|iframe)\b|<!doctype|\sstyle\s*=|http-equiv/iu;
// Front-Channel Logout 1.0 §3: the logout page frames each relying party's
// logout URL, and `frames` derives `frame-src` from exactly those frames.
const MAY_FRAME = ['packages/protocol-oidc/src/view/logout-html.ts'];

interface Renderer {
  readonly path: string;
  readonly text: string;
}

async function renderersUnder(dir: string): Promise<Renderer[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = await Promise.all(
    entries.map(async (entry): Promise<Renderer[]> => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return renderersUnder(path);
      if (!entry.name.endsWith('-html.ts')) return [];
      return [{ path, text: await readFile(path, 'utf8') }];
    }),
  );
  return found.flat();
}

async function allRenderers(): Promise<Renderer[]> {
  const roots = [
    ...(await readdir(PACKAGES_DIR)).map((name) => join(PACKAGES_DIR, name, 'src/view')),
    ...(await readdir(APPS_DIR)).map((name) => join(APPS_DIR, name, 'src')),
  ];
  return (await Promise.all(roots.map(renderersUnder))).flat();
}

interface Reading {
  // The local name `page` is bound to by an import from the package's shell.
  readonly pageBinding: string | null;
  readonly callsPage: boolean;
  // Every string fragment in source order, joined, comments excluded.
  readonly literals: string;
}

function read(text: string): Reading {
  const file = ts.createSourceFile('renderer.ts', text, ts.ScriptTarget.Latest, true);
  const bindings: string[] = [];
  const called = new Set<string>();
  const fragments: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === SHELL_MODULE
    ) {
      const named = node.importClause?.namedBindings;
      if (named !== undefined && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if ((element.propertyName ?? element.name).text === 'page') {
            bindings.push(element.name.text);
          }
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      called.add(node.expression.text);
    }
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (!ts.isImportDeclaration(node.parent)) fragments.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const pageBinding = bindings[0] ?? null;
  return {
    pageBinding,
    callsPage: pageBinding !== null && called.has(pageBinding),
    literals: fragments.join(''),
  };
}

const relative = (path: string): string => path.slice(REPO_ROOT.length + 1);

const withoutPageCall = (renderers: readonly Renderer[]): string[] =>
  renderers.filter((r) => !read(r.text).callsPage).map((r) => relative(r.path));

const ownMarkup = (renderers: readonly Renderer[]): string[] =>
  renderers
    .filter((r) => !MAY_FRAME.includes(relative(r.path)))
    .filter((r) => OWN_MARKUP.test(read(r.text).literals))
    .map((r) => relative(r.path));

// Only `<iframe` and a meta refresh (the redirect a browser without script
// still follows once the frames have had their turn) are allowed where the
// renderer is named; the rest of the list still applies to it.
const otherMarkupInFramingRenderers = (renderers: readonly Renderer[]): string[] =>
  renderers
    .filter((r) => MAY_FRAME.includes(relative(r.path)))
    .filter((r) =>
      OWN_MARKUP.test(read(r.text).literals.replace(/<iframe\b|<meta http-equiv="refresh"/giu, '')),
    )
    .map((r) => relative(r.path));

// A renderer's test must be a real one: a file that has at least one `it` or
// `test` and imports the renderer.
function testProblem(rendererPath: string, testText: string): string | null {
  const stem = rendererPath.slice(rendererPath.lastIndexOf('/') + 1).replace(/\.ts$/u, '');
  const file = ts.createSourceFile('x.test.ts', testText, ts.ScriptTarget.Latest, true);
  const state = { cases: 0, imports: false };
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'it' || node.expression.text === 'test')
    ) {
      state.cases++;
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.endsWith(`/${stem}`)
    ) {
      state.imports = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (state.cases === 0) return 'has no it() or test()';
  return state.imports ? null : `does not import ${stem}`;
}

async function testProblems(renderers: readonly Renderer[]): Promise<string[]> {
  return (
    await Promise.all(
      renderers.map(async (r) => {
        const testPath = r.path.replace(/\.ts$/u, '.test.ts');
        if (!existsSync(testPath)) return `${relative(r.path)} has no test file`;
        const problem = testProblem(r.path, await readFile(testPath, 'utf8'));
        return problem === null ? null : `${relative(r.path)} ${problem}`;
      }),
    )
  ).filter((line): line is string => line !== null);
}

function shellsOf(renderers: readonly Renderer[]): string[] {
  const dirs = new Set(renderers.map((r) => r.path.slice(0, r.path.indexOf('/src/') + 5)));
  return [...dirs].map((dir) => `${dir}view/document.ts`).sort();
}

describe('every server page is under Instrument', () => {
  it('finds the renderers, so an empty scan cannot pass', async () => {
    expect((await allRenderers()).length).toBeGreaterThanOrEqual(15);
  });

  it('calls its package shell page() in every renderer', async () => {
    expect(withoutPageCall(await allRenderers())).toEqual([]);
  });

  it('builds no document of its own', async () => {
    expect(ownMarkup(await allRenderers())).toEqual([]);
  });

  it('frames only where the logout page is named to, and builds nothing else of its own', async () => {
    const renderers = await allRenderers();
    expect(renderers.some((r) => MAY_FRAME.includes(relative(r.path)))).toBe(true);
    expect(otherMarkupInFramingRenderers(renderers)).toEqual([]);
  });

  it('has a real renderer test for every renderer', async () => {
    expect(await testProblems(await allRenderers())).toEqual([]);
  });

  // The shell is duplicated per package on purpose, so the copies are held
  // to one text, comments aside. Which packages have one is read from the
  // renderers, not listed here.
  it('keeps every package shell to one document', async () => {
    const shells = shellsOf(await allRenderers());
    expect(shells.length).toBeGreaterThanOrEqual(4);
    const code = (text: string): string =>
      text
        .split('\n')
        .filter((line) => line.trim() !== '' && !/^\s*\/\//u.test(line))
        .join('\n');
    const texts = await Promise.all(shells.map(async (path) => code(await readFile(path, 'utf8'))));
    for (const text of texts) expect(text).toBe(texts[0]);
  });
});

describe('the check refuses what it is meant to', () => {
  const fixture = async (name: string): Promise<Renderer[]> =>
    (await renderersUnder(FIXTURE)).filter((r) => r.path.endsWith(name));

  it('reads the fixture directory, subdirectories included', async () => {
    const names = (await renderersUnder(FIXTURE)).map((r) => r.path.slice(FIXTURE.length + 1));
    expect(names).toContain('nested/deep-html.ts');
  });

  it('fails a renderer that builds its own document', async () => {
    const bad = await fixture('/bad-html.ts');
    expect(withoutPageCall(bad)).toHaveLength(1);
    expect(ownMarkup(bad)).toHaveLength(1);
    expect(await testProblems(bad)).toHaveLength(1);
  });

  it('fails a renderer that imports only escapeHtml from the shell', async () => {
    expect(withoutPageCall(await fixture('/escape-only-html.ts'))).toHaveLength(1);
  });

  it('is not satisfied by the import and the call written in a comment or a string', async () => {
    expect(withoutPageCall(await fixture('/commented-import-html.ts'))).toHaveLength(1);
  });

  it('sees `<html` and `<head` assembled from fragments', async () => {
    expect(ownMarkup(await fixture('/concatenated-html.ts'))).toHaveLength(1);
  });

  it('fails a renderer in a subdirectory', async () => {
    const deep = await fixture('/nested/deep-html.ts');
    expect(withoutPageCall(deep)).toHaveLength(1);
    expect(ownMarkup(deep)).toHaveLength(1);
  });

  it('refuses a meta refresh and an iframe in a renderer that is not the logout page', async () => {
    const refresh = await fixture('/refresh-html.ts');
    expect(withoutPageCall(refresh)).toHaveLength(0);
    expect(ownMarkup(refresh)).toHaveLength(1);
  });

  it('refuses a test file that is empty, has no case, or does not import the renderer', () => {
    expect(testProblem('a/x-html.ts', '')).not.toBeNull();
    expect(testProblem('a/x-html.ts', "import { x } from '#/view/x-html';")).not.toBeNull();
    expect(testProblem('a/x-html.ts', "it('a', () => undefined);")).not.toBeNull();
    expect(
      testProblem('a/x-html.ts', "import { x } from '#/view/x-html';\nit('a', () => x());"),
    ).toBeNull();
  });
});
