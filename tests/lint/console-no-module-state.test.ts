import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Module-level mutable state outlives a test and nothing resets it: a store's
// creator or a hook is where it lives. Found: a top-level `let`; a top-level
// `const` set, map, array or object that the same file mutates; and a
// load-time call to a console function whose closures keep a mutable binding.
// A constant nobody mutates (`as const`, frozen, a regex, a lookup Set) is not
// state, which is why mutation and not the initialiser decides. `testing/` and
// test files are out of scope: a harness owns its state by design.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONSOLE = 'apps/admin-console';
const FIXTURES = 'tests/lint/fixtures/console-no-module-state';
const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'add',
  'set',
  'delete',
  'clear',
]);
const COLLECTIONS = new Set(['Set', 'Map', 'WeakSet', 'WeakMap']);
const ASSIGNMENTS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

interface Source {
  file: string;
  tree: ts.SourceFile;
}

function unwrap(node: ts.Expression): ts.Expression {
  let at = node;
  while (ts.isParenthesizedExpression(at) || ts.isNonNullExpression(at) || ts.isAsExpression(at)) {
    if (ts.isAsExpression(at) && ts.isTypeReferenceNode(at.type) && at.type.getText() === 'const') {
      break;
    }
    at = at.expression;
  }
  return at;
}

function isMutableValue(init: ts.Expression): boolean {
  const value = unwrap(init);
  return (
    ts.isArrayLiteralExpression(value) ||
    ts.isObjectLiteralExpression(value) ||
    (ts.isNewExpression(value) &&
      ts.isIdentifier(value.expression) &&
      COLLECTIONS.has(value.expression.text))
  );
}

// `x`, `x.a`, `x[k].b`, `(x as T)!.c`: the name a member chain starts from.
function rootOf(node: ts.Expression): string | null {
  let at = node;
  for (;;) {
    if (ts.isIdentifier(at)) return at.text;
    if (ts.isPropertyAccessExpression(at) || ts.isElementAccessExpression(at)) at = at.expression;
    else if (ts.isParenthesizedExpression(at) || ts.isNonNullExpression(at)) at = at.expression;
    else if (ts.isAsExpression(at)) at = at.expression;
    else return null;
  }
}

function boundNames(name: ts.BindingName, out: Set<string>): void {
  if (ts.isIdentifier(name)) out.add(name.text);
  else
    for (const element of name.elements)
      if (!ts.isOmittedExpression(element)) boundNames(element.name, out);
}

function declaredIn(scope: ts.Node): Set<string> {
  const names = new Set<string>();
  const statements = ts.isBlock(scope) || ts.isSourceFile(scope) ? scope.statements : [];
  for (const statement of statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        boundNames(declaration.name, names);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}

// Whether `name` at `node` is a binding of something between it and `scope`.
function shadowed(node: ts.Node, name: string, scope: ts.Node): boolean {
  for (let at = node.parent; at !== scope; at = at.parent) {
    if (ts.isFunctionLike(at)) {
      const parameters = new Set<string>();
      for (const parameter of at.parameters) boundNames(parameter.name, parameters);
      if (parameters.has(name)) return true;
    }
    if ((ts.isBlock(at) || ts.isSourceFile(at)) && declaredIn(at).has(name)) return true;
  }
  return false;
}

function lineOf(tree: ts.SourceFile, node: ts.Node): number {
  return tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

// The line of the first thing inside `scope` that changes what `name` holds.
function mutationOf(tree: ts.SourceFile, scope: ts.Node, name: string): number | null {
  let found: number | null = null;
  const reaches = (node: ts.Expression): boolean =>
    rootOf(node) === name && !shadowed(node, name, scope);
  const visit = (node: ts.Node): void => {
    if (found !== null) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      MUTATORS.has(node.expression.name.text) &&
      reaches(node.expression.expression)
    ) {
      found = lineOf(tree, node);
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === 'Object' &&
      node.expression.name.text === 'assign' &&
      node.arguments[0] !== undefined &&
      reaches(node.arguments[0])
    ) {
      found = lineOf(tree, node);
    } else if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENTS.has(node.operatorToken.kind) &&
      !ts.isIdentifier(node.left) &&
      reaches(node.left)
    ) {
      found = lineOf(tree, node);
    } else if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      !ts.isIdentifier(node.operand) &&
      reaches(node.operand)
    ) {
      found = lineOf(tree, node);
    } else if (ts.isDeleteExpression(node) && reaches(node.expression)) {
      found = lineOf(tree, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

function isReference(node: ts.Identifier): boolean {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(parent)) return parent.name !== node;
  if (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent))
    return parent.name !== node;
  return !((ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === node);
}

// A function nested in `scope` that reads or writes `name`.
function capturedIn(scope: ts.Node, name: string): boolean {
  let captured = false;
  const visit = (node: ts.Node, inner: boolean): void => {
    if (captured) return;
    if (inner && ts.isIdentifier(node) && node.text === name && isReference(node)) {
      if (!shadowed(node, name, scope)) captured = true;
      return;
    }
    ts.forEachChild(node, (child) => {
      visit(child, inner || ts.isFunctionLike(child));
    });
  };
  visit(scope, false);
  return captured;
}

function assignmentsOf(scope: ts.Node, name: string): ts.BinaryExpression[] {
  const found: ts.BinaryExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENTS.has(node.operatorToken.kind) &&
      ts.isIdentifier(node.left) &&
      node.left.text === name
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

function changesInPlace(scope: ts.Node, name: string): boolean {
  let changes = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      ts.isIdentifier(node.operand) &&
      node.operand.text === name
    ) {
      changes = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return changes;
}

const PLAIN = new Set([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken]);

function startsEmpty(declaration: ts.VariableDeclaration): boolean {
  const init = declaration.initializer;
  return (
    init === undefined ||
    init.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(init) && init.text === 'undefined')
  );
}

interface Factory {
  name: string;
  file: string;
  holds: string;
  at: number;
}

// What a function body keeps alive for the closures it creates.
function stateOf(source: Source, name: string, fn: ts.FunctionLikeDeclaration): Factory | null {
  const body = fn.body;
  if (body === undefined || !ts.isBlock(body)) return null;
  for (const statement of body.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isLet = (statement.declarationList.flags & ts.NodeFlags.Let) !== 0;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const held = declaration.name.text;
      if (!capturedIn(body, held)) continue;
      const memo =
        isLet &&
        startsEmpty(declaration) &&
        assignmentsOf(body, held).every((each) => PLAIN.has(each.operatorToken.kind)) &&
        !changesInPlace(body, held);
      const mutable = isLet
        ? !memo
        : declaration.initializer !== undefined &&
          isMutableValue(declaration.initializer) &&
          mutationOf(source.tree, body, held) !== null;
      if (mutable) {
        return { name, file: source.file, holds: held, at: lineOf(source.tree, declaration) };
      }
    }
  }
  return null;
}

function factoriesOf(source: Source): Factory[] {
  const found: Factory[] = [];
  for (const statement of source.tree.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      const state = stateOf(source, statement.name.text, statement);
      if (state !== null) found.push(state);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer;
        if (
          ts.isIdentifier(declaration.name) &&
          init !== undefined &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          const state = stateOf(source, declaration.name.text, init);
          if (state !== null) found.push(state);
        }
      }
    }
  }
  return found;
}

function importedNames(tree: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of tree.statements) {
    const bindings = ts.isImportDeclaration(statement)
      ? statement.importClause?.namedBindings
      : undefined;
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements)
        names.add((element.propertyName ?? element.name).text);
    }
  }
  return names;
}

// Calls made while the module loads: not inside any function or class body.
function loadTimeCalls(statement: ts.Statement): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return;
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer !== undefined) visit(declaration.initializer);
    }
  } else if (ts.isExpressionStatement(statement) || ts.isExportAssignment(statement)) {
    visit(statement.expression);
  }
  return calls;
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
  const factories = sources.flatMap((source) => factoriesOf(source));
  const found: string[] = [];
  for (const source of sources) {
    const { file, tree } = source;
    const known = importedNames(tree);
    for (const statement of tree.statements) {
      if (ts.isVariableStatement(statement)) {
        const isLet = (statement.declarationList.flags & ts.NodeFlags.Let) !== 0;
        for (const declaration of statement.declarationList.declarations) {
          const names = new Set<string>();
          boundNames(declaration.name, names);
          const line = lineOf(tree, declaration);
          if (isLet) {
            found.push(`${file}:${String(line)}: top-level let ${[...names].join(', ')}`);
          } else if (
            ts.isIdentifier(declaration.name) &&
            declaration.initializer !== undefined &&
            isMutableValue(declaration.initializer)
          ) {
            const at = mutationOf(tree, tree, declaration.name.text);
            if (at !== null) {
              found.push(
                `${file}:${String(line)}: top-level ${declaration.name.text} is mutated at line ${String(at)}`,
              );
            }
          }
        }
      }
      for (const call of loadTimeCalls(statement)) {
        if (!ts.isIdentifier(call.expression)) continue;
        const callee = call.expression.text;
        const factory = factories.find(
          (each) => each.name === callee && (each.file === file || known.has(callee)),
        );
        if (factory !== undefined) {
          found.push(
            `${file}:${String(lineOf(tree, call))}: ${callee}() at module scope keeps ${factory.holds} (${factory.file}:${String(factory.at)}) alive for every caller`,
          );
        }
      }
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
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
  it('keeps no mutable state at module scope, tests and testing/ excepted', async () => {
    const files = await read(CONSOLE);
    const names = [...files.keys()];
    expect(names).toContain('src/shared/repository/useDrafts.ts');
    expect(names).toContain('src/app/lazyFeatureRoute/lazyFeatureRoute.tsx');
    expect(names).toContain('src/shared/transport/gateway.ts');
    expect(violations(files)).toEqual([]);
  });

  it('pass every conforming fixture', async () => {
    const files = await read(`${FIXTURES}/pass`);
    expect(files.size).toBeGreaterThan(8);
    expect(violations(files)).toEqual([]);
  });

  it('fail every non-conforming fixture, naming the file and the line', async () => {
    const files = await read(`${FIXTURES}/fail`);
    expect(files.size).toBeGreaterThan(5);
    expect(violations(files)).toEqual([
      'src/app/counter.ts:9: createCounter() at module scope keeps count (src/app/counter.ts:2) alive for every caller',
      'src/app/flag.ts:6: makeLatch() at module scope keeps open (src/app/flag.ts:2) alive for every caller',
      'src/shared/repository/counter.ts:1: top-level let issued',
      'src/shared/repository/registry.ts:1: top-level sources is mutated at line 8',
      'src/shared/repository/registry.ts:2: top-level queue is mutated at line 9',
      'src/shared/repository/registry.ts:3: top-level state is mutated at line 10',
      'src/shared/repository/registry.ts:4: top-level seen is mutated at line 12',
      'src/shared/repository/registry.ts:5: top-level options is mutated at line 13',
      'src/shared/repository/ticks.ts:1: top-level clock is mutated at line 4',
      'src/shared/transport/gateway.ts:3: createEvents() at module scope keeps listeners (src/shared/transport/events.ts:2) alive for every caller',
    ]);
  });
});
