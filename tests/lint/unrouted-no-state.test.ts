import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The answers to an unknown address and an unhandled failure answer unbounded
// unauthenticated traffic, so they keep nothing between requests: no `let`, no
// Map, Set or WeakMap, and no write through a module-scope name. A cache keyed
// by path, header or request would be unbounded memory. Read as syntax; it
// does not see state held in a closure built per call, which dies with it.
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const FILES = [
  'packages/protocol-oidc/src/service/page-negotiation.ts',
  'packages/protocol-oidc/src/view/routes/unrouted.ts',
  'packages/protocol-oidc/src/view/not-found-html.ts',
  'packages/protocol-oidc/src/view/server-error-html.ts',
  'packages/protocol-oidc/src/view/lost-art.ts',
];
const MUTATORS = new Set(['set', 'add', 'push', 'unshift', 'splice', 'delete', 'clear', 'pop']);
const CACHES = new Set(['Map', 'WeakMap', 'Set', 'WeakSet']);

function stateIn(text: string): string[] {
  const file = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true);
  const moduleNames = new Set<string>();
  const found: string[] = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) found.push('a module-scope let');
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) moduleNames.add(declaration.name.text);
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CACHES.has(node.expression.text) &&
      // A constant lookup is built from literals; one built empty is a cache.
      (node.arguments?.length ?? 0) === 0
    ) {
      found.push(`an empty ${node.expression.text}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      moduleNames.has(node.expression.expression.text) &&
      MUTATORS.has(node.expression.name.text)
    ) {
      found.push(`${node.expression.expression.text}.${node.expression.name.text}()`);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isElementAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      moduleNames.has(node.left.expression.text)
    ) {
      found.push(`${node.left.expression.text}[…] =`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('the unrouted answers keep no state between requests', () => {
  it.each(FILES)('%s holds none', (file) => {
    expect(stateIn(readFileSync(path.join(REPO_ROOT, file), 'utf8'))).toEqual([]);
  });

  it('sees a cache, a counter and a write through a module-scope name', () => {
    expect(stateIn('let hits = 0;')).toEqual(['a module-scope let']);
    expect(stateIn('const seen = new Map();')).toEqual(['an empty Map']);
    expect(
      stateIn('const seen = new Set<string>();\nexport const f = (p: string) => seen.add(p);'),
    ).toEqual(['an empty Set', 'seen.add()']);
    expect(stateIn('const by = {};\nexport const f = (p: string) => { by[p] = 1; };')).toEqual([
      'by[…] =',
    ]);
  });

  it('allows a constant lookup built from literals', () => {
    expect(
      stateIn("const API = new Set(['a', 'b']);\nexport const f = (p: string) => API.has(p);"),
    ).toEqual([]);
  });
});
