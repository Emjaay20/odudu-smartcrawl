import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// A hook or component takes a store's actions through a selector, so the
// dependency is visible and the action is a stable reference. In non-test
// source this finds an action called through `.getState()` inside a `use*`
// function or a PascalCase component at any depth, `S.setState(…)` anywhere,
// and `useS()` with no selector. A `.getState()` that only reads data, or any
// in a module function outside a hook or component, is imperative and allowed.
// A store is a top-level export built with zustand's `create`.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONSOLE = 'apps/admin-console';
const FIXTURES = 'tests/lint/fixtures/console-store-access';

interface Source {
  file: string;
  tree: ts.SourceFile;
}

function isHookOrComponent(name: string): boolean {
  return /^use[A-Z0-9]/u.test(name) || /^[A-Z]/u.test(name);
}

type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

function isFunctionNode(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
  );
}

function nameOf(fn: FunctionNode): string | null {
  if (!ts.isArrowFunction(fn)) return fn.name?.text ?? null;
  return ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)
    ? fn.parent.name.text
    : null;
}

// The hook or component a node sits in, however deeply nested.
function enclosing(node: ts.Node): string | null {
  for (let at: ts.Node = node.parent; !ts.isSourceFile(at); at = at.parent) {
    if (isFunctionNode(at)) {
      const name = nameOf(at);
      if (name !== null && isHookOrComponent(name)) return name;
    }
  }
  return null;
}

function leftmostCallee(node: ts.Expression): ts.Expression {
  let at = node;
  while (ts.isCallExpression(at)) at = at.expression;
  return at;
}

function zustandCreate(tree: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const named = statement.importClause?.namedBindings;
    if (
      named !== undefined &&
      ts.isNamedImports(named) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'zustand'
    ) {
      for (const element of named.elements) {
        if ((element.propertyName ?? element.name).text === 'create') names.add(element.name.text);
      }
    }
  }
  return names;
}

function storesOf(source: Source): string[] {
  const makers = zustandCreate(source.tree);
  const stores: string[] = [];
  for (const statement of source.tree.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (ts.isIdentifier(declaration.name) && init !== undefined && ts.isCallExpression(init)) {
        const callee = leftmostCallee(init);
        if (ts.isIdentifier(callee) && makers.has(callee.text)) stores.push(declaration.name.text);
      }
    }
  }
  return stores;
}

// `S.getState()` for a store S.
function isStateRead(node: ts.Node, stores: Set<string>): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'getState' &&
    ts.isIdentifier(node.expression.expression) &&
    stores.has(node.expression.expression.text)
  );
}

function chainStart(node: ts.Expression): ts.Expression {
  let at = node;
  while (ts.isPropertyAccessExpression(at) || ts.isElementAccessExpression(at)) at = at.expression;
  return at;
}

function lineOf(tree: ts.SourceFile, node: ts.Node): number {
  return tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

// What a hook or component takes out of a store's state: a destructured name
// or the whole state under one name.
function takenFromState(scope: ts.Node, stores: Set<string>): Set<string> {
  const taken = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer !== undefined &&
      isStateRead(node.initializer, stores)
    ) {
      if (ts.isIdentifier(node.name)) taken.add(node.name.text);
      else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (ts.isIdentifier(element.name)) taken.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return taken;
}

function isScanned(file: string): boolean {
  return (
    /\.tsx?$/u.test(file) &&
    !/\.test\.tsx?$/u.test(file) &&
    !file.endsWith('.d.ts') &&
    !file.startsWith('src/testing/')
  );
}

// `files` maps a path relative to the console root to its text.
export function violations(files: Map<string, string>): string[] {
  const sources: Source[] = [...files]
    .filter(([file]) => isScanned(file))
    .map(([file, text]) => ({
      file,
      tree: ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    }));
  const stores = new Set(sources.flatMap((source) => storesOf(source)));
  const found = new Set<string>();
  for (const { file, tree } of sources) {
    const report = (node: ts.Node, what: string): void => {
      found.add(`${file}:${String(lineOf(tree, node))}: ${what}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === 'setState' &&
          ts.isIdentifier(callee.expression) &&
          stores.has(callee.expression.text)
        ) {
          report(node, `${callee.expression.text}.setState changes the store outside its actions`);
        }
        if (ts.isIdentifier(callee) && stores.has(callee.text) && node.arguments.length === 0) {
          report(node, `${callee.text}() subscribes to the whole store; pass a selector`);
        }
        const host = enclosing(node);
        if (host !== null && ts.isPropertyAccessExpression(callee)) {
          const start = chainStart(callee.expression);
          if (isStateRead(start, stores)) {
            report(node, `${host} calls a store action through getState; select it instead`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    const lookInto = (node: ts.Node): void => {
      if (isFunctionNode(node)) {
        const name = nameOf(node);
        if (name !== null && isHookOrComponent(name) && node.body !== undefined) {
          const taken = takenFromState(node.body, stores);
          const calls = (inner: ts.Node): void => {
            if (ts.isCallExpression(inner)) {
              const callee = inner.expression;
              const root = chainStart(
                ts.isPropertyAccessExpression(callee) ? callee.expression : callee,
              );
              const direct = ts.isIdentifier(callee) && taken.has(callee.text);
              const member =
                ts.isPropertyAccessExpression(callee) &&
                ts.isIdentifier(root) &&
                taken.has(root.text);
              if (direct || member) {
                report(inner, `${name} calls a store action through getState; select it instead`);
              }
            }
            ts.forEachChild(inner, calls);
          };
          calls(node.body);
        }
      }
      ts.forEachChild(node, lookInto);
    };
    lookInto(tree);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

async function read(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const file of glob('src/**/*.{ts,tsx}', { cwd: path.join(REPO_ROOT, root) })) {
    const posix = file.split(path.sep).join('/');
    files.set(posix, await readFile(path.join(REPO_ROOT, root, file), 'utf8'));
  }
  return files;
}

describe('console source', { timeout: 60_000 }, () => {
  it('reaches stores through selectors, tests and testing/ excepted', async () => {
    const files = await read(CONSOLE);
    const names = [...files.keys()];
    expect(names).toContain('src/shared/repository/useUnsavedGuard.ts');
    expect(names).toContain('src/app/NavigationGuard/NavigationGuard.tsx');
    expect(violations(files)).toEqual([]);
  });

  it('pass every conforming fixture', async () => {
    const files = await read(`${FIXTURES}/pass`);
    expect(files.size).toBeGreaterThan(5);
    expect(violations(files)).toEqual([]);
  });

  it('fail every non-conforming fixture, naming the file and the line', async () => {
    const files = await read(`${FIXTURES}/fail`);
    expect(files.size).toBeGreaterThan(4);
    expect(violations(files)).toEqual([
      'src/app/Leave.tsx:11: useToasts() subscribes to the whole store; pass a selector',
      'src/app/Leave.tsx:16: useDrafts() subscribes to the whole store; pass a selector',
      'src/app/Leave.tsx:6: Leave calls a store action through getState; select it instead',
      'src/app/Nested.tsx:7: Nested calls a store action through getState; select it instead',
      'src/features/session/repository/reset.ts:4: useToasts.setState changes the store outside its actions',
      'src/features/session/repository/useSignIn.ts:13: useSignOut calls a store action through getState; select it instead',
      'src/features/session/repository/useSignIn.ts:6: useSignIn calls a store action through getState; select it instead',
    ]);
  });
});
