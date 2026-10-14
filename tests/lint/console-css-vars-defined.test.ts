import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// A `var(--name)` with no declaration renders as nothing, silently: an
// undefined ink inherits whatever colour is around it. A name is accepted when
// the console declares it (`--name:` or `@property --name` in any stylesheet, a quoted
// `'--name':` key in a style object, or `setProperty('--name', …)`), or when
// the use carries its own fallback, `var(--name, 0)`: the author then states
// that the name may be unset, as a library's runtime property is until it
// sets it. Names are never listed, so a typo such as `--space-5` fails.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONSOLE = 'apps/admin-console';
const FIXTURES = 'tests/lint/fixtures/console-css-vars-defined';
const USE = /var\(\s*(--[\w-]+)\s*(,)?/gu;
const DECLARATION = /(?:^|[\s{;'"])(--[\w-]+)\s*:|@property\s+(--[\w-]+)/gu;

interface Use {
  name: string;
  line: number;
  fallback: boolean;
}

interface Found {
  declared: Set<string>;
  uses: Map<string, Use[]>;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ' '));
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

function scanText(text: string, firstLine: number, found: Found, file: string): void {
  for (const match of text.matchAll(DECLARATION)) found.declared.add(match[1] ?? match[2] ?? '');
  for (const match of text.matchAll(USE)) {
    const uses = found.uses.get(file) ?? [];
    uses.push({
      name: match[1] ?? '',
      line: firstLine + lineAt(text, match.index) - 1,
      fallback: match[2] !== undefined,
    });
    found.uses.set(file, uses);
  }
}

function scanScript(file: string, source: string, found: Found): void {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const first = tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      scanText(node.text, first, found, file);
      if (
        ts.isStringLiteral(node) &&
        node.text.startsWith('--') &&
        ((ts.isPropertyAssignment(node.parent) && node.parent.name === node) ||
          (ts.isCallExpression(node.parent) &&
            ts.isPropertyAccessExpression(node.parent.expression) &&
            node.parent.expression.name.text === 'setProperty' &&
            node.parent.arguments[0] === node))
      ) {
        found.declared.add(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}

// `files` maps a path relative to the console root to its text.
export function violations(files: Map<string, string>): string[] {
  const found: Found = { declared: new Set(), uses: new Map() };
  for (const [file, text] of files) {
    if (file.endsWith('.css')) scanText(stripComments(text), 1, found, file);
    else if (/\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file) && !file.endsWith('.d.ts')) {
      scanScript(file, text, found);
    }
  }
  return [...found.uses]
    .flatMap(([file, uses]) =>
      uses
        .filter((use) => !use.fallback && !found.declared.has(use.name))
        .map(
          (use) =>
            `${file}:${String(use.line)}: var(${use.name}) is declared nowhere in the console; declare it, set it in a style object, or give the use a fallback`,
        ),
    )
    .sort((a, b) => a.localeCompare(b));
}

async function read(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const file of glob('src/**/*.{css,ts,tsx}', { cwd: path.join(REPO_ROOT, root) })) {
    const posix = file.split(path.sep).join('/');
    files.set(posix, await readFile(path.join(REPO_ROOT, root, file), 'utf8'));
  }
  return files;
}

describe('console custom properties', { timeout: 60_000 }, () => {
  it('are each declared, or used with a fallback', async () => {
    const files = await read(CONSOLE);
    const names = [...files.keys()];
    expect(names).toContain('src/shared/view/tokens.css');
    expect(names.filter((file) => file.endsWith('.module.css')).length).toBeGreaterThan(50);
    expect(violations(files)).toEqual([]);
  });

  it('pass every conforming fixture', async () => {
    const files = await read(`${FIXTURES}/pass`);
    expect(files.size).toBeGreaterThan(2);
    expect(violations(files)).toEqual([]);
  });

  it('fail every non-conforming fixture, naming the file and the line', async () => {
    const files = await read(`${FIXTURES}/fail`);
    expect(files.size).toBeGreaterThan(2);
    const advice =
      'is declared nowhere in the console; declare it, set it in a style object, or give the use a fallback';
    expect(violations(files)).toEqual([
      `src/features/signing-keys/view/Keys.tsx:2: var(--type-14) ${advice}`,
      `src/features/signing-keys/view/Keys.tsx:7: var(--edge) ${advice}`,
      `src/shared/view/Field.module.css:2: var(--space-5) ${advice}`,
      `src/shared/view/Field.module.css:6: var(--ink-danger) ${advice}`,
      `src/shared/view/Field.module.css:7: var(--space-9) ${advice}`,
    ]);
  });
});
