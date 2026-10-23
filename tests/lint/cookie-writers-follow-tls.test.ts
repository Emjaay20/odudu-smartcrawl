import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Every cookie the server writes takes its prefix and Secure from ODUDU_TLS,
// handed down as `tls`. A helper called with a literal or without it, or a
// cookie header built by hand, ignores the setting: the session cookie once
// shipped without Secure behind ODUDU_TLS=true that way.

// Cannot see: a `tls` variable that is itself wrong, a helper reached through
// an alias or a spread, a cookie written by a library. The integration test
// apps/server/tests/cookies-under-tls.int.test.ts reads the real Set-Cookie of
// each flow for those.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SOURCES = ['packages/*/src/**/*.ts', 'apps/server/src/**/*.ts'];

// The helper, and where `tls` sits for each number of arguments it is called with.
const HELPERS: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  sessionCookieName: { 1: 0, 2: 1 },
  loginCookieName: { 1: 0 },
  restartCookieName: { 1: 0 },
  loginCookie: { 2: 1 },
  clearedLoginCookie: { 1: 0 },
  restartCookie: { 1: 0 },
  clearedRestartCookie: { 1: 0 },
  sessionCookie: { 2: 1 },
  clearedSessionCookie: { 1: 0 },
  clearedSessionCookies: { 2: 1 },
  readSessionEntries: { 3: 2 },
  signInHandleName: { 1: 0 },
  signInHandleCookie: { 5: 1 },
  clearedSignInHandleCookie: { 2: 1 },
  readSignInHandle: { 2: 1 },
};
const OBJECT_HELPERS = new Set(['sessionCookies', 'oidcRoutes', 'consoleGateway']);

function isLiteral(node: ts.Node): boolean {
  return (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    ts.isStringLiteralLike(node)
  );
}

export function findings(fileName: string, text: string): { problems: string[]; sites: number } {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  let sites = 0;
  const where = (node: ts.Node): string =>
    `${fileName}:${String(file.getLineAndCharacterOfPosition(node.getStart()).line + 1)}`;

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression) ? node.expression.text : undefined;
      const helper = callee === undefined ? undefined : HELPERS[callee];
      if (callee !== undefined && helper !== undefined) {
        sites += 1;
        const index = helper[node.arguments.length];
        const given = index === undefined ? undefined : node.arguments[index];
        if (given === undefined) problems.push(`${where(node)} ${callee} is called without tls`);
        else if (isLiteral(given))
          problems.push(`${where(node)} ${callee} is called with a literal tls`);
      }
      if (callee !== undefined && OBJECT_HELPERS.has(callee)) {
        const [first] = node.arguments;
        if (first !== undefined && ts.isObjectLiteralExpression(first)) {
          sites += 1;
          const property = first.properties.find(
            (candidate) =>
              (ts.isShorthandPropertyAssignment(candidate) || ts.isPropertyAssignment(candidate)) &&
              candidate.name.getText() === 'tls',
          );
          if (property === undefined)
            problems.push(`${where(node)} ${callee} is called without tls`);
          else if (ts.isPropertyAssignment(property) && isLiteral(property.initializer)) {
            problems.push(`${where(node)} ${callee} is called with a literal tls`);
          }
        }
      }
      // A cookie header assembled by hand rather than by a helper.
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'header' &&
        node.arguments.length === 2 &&
        ts.isStringLiteralLike(node.arguments[0] as ts.Node) &&
        (node.arguments[0] as ts.StringLiteral).text.toLowerCase() === 'set-cookie' &&
        (ts.isStringLiteralLike(node.arguments[1] as ts.Node) ||
          ts.isTemplateExpression(node.arguments[1] as ts.Node))
      ) {
        problems.push(`${where(node)} a set-cookie header is written by hand`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { problems, sites };
}

describe('every cookie writer is told whether TLS is on', () => {
  it('finds nothing in the server sources', { timeout: 60_000 }, async () => {
    const problems: string[] = [];
    let sites = 0;
    for (const pattern of SOURCES) {
      for await (const relative of glob(pattern, { cwd: REPO_ROOT })) {
        const unix = relative.split(path.sep).join('/');
        if (
          /\.test\.tsx?$/u.test(unix) ||
          unix.includes('/testing/') ||
          unix.includes('node_modules')
        )
          continue;
        const result = findings(unix, await readFile(path.join(REPO_ROOT, unix), 'utf8'));
        problems.push(...result.problems);
        sites += result.sites;
      }
    }
    expect(problems).toEqual([]);
    // Not vacuous: the writers are called in many places.
    expect(sites).toBeGreaterThanOrEqual(12);
  });

  it.each([
    ['a helper called with a literal', "loginCookie('s', false);", 'literal tls'],
    ['a helper called without tls', 'clearedSessionCookies(tenant);', 'without tls'],
    ['the sign-in handle with a literal', 'signInHandleCookie(t, true, id, s, 1);', 'literal tls'],
    ['a session cookie list without tls', 'sessionCookies({ tenant, ephemeral });', 'without tls'],
    ['a literal inside it', 'sessionCookies({ tls: false });', 'literal tls'],
    ['the oidc routes without tls', 'oidcRoutes({ database });', 'without tls'],
    ['the console without tls', 'consoleGateway({ database });', 'without tls'],
    ['a hand-built header', "reply.header('set-cookie', `a=${v}`);", 'by hand'],
  ])('reports %s', (_label, source, expected) => {
    const { problems } = findings('x.ts', source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(expected);
  });

  it.each([
    'loginCookie(state, deps.tls);',
    'sessionCookies({ tenant, tls, ephemeral });',
    'oidcRoutes({ database, tls });',
    "reply.header('set-cookie', cookie);",
    'readSessionEntries(header, tenant.name, tls);',
  ])('accepts %s', (source) => {
    expect(findings('x.ts', source).problems).toEqual([]);
  });
});
