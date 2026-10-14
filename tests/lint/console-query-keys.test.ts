import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// A cache key typed by hand in a feature drifts from the function that builds
// the same key elsewhere, and an invalidation then misses it without a sound.
// Keys come from shared/repository/queryKeys.ts. In non-test source this finds
// an array literal used as a key (a `queryKey` or `key` property, or the first
// argument of a cache call), a call to `invalidateQueries` outside the two files
// that wrap it, and any array starting with a kind literal those functions
// produce. The kinds are read from the module, never listed. Identifiers and
// calls are accepted as keys, so a key returned by a factory passes.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONSOLE = 'apps/admin-console';
const FIXTURES = 'tests/lint/fixtures/console-query-keys';
const KEYS_FILE = 'src/shared/repository/queryKeys.ts';
const INVALIDATORS = new Set([
  'src/shared/repository/useInvalidate.ts',
  'src/shared/repository/useAfterChange.ts',
]);
const KEY_PROPERTIES = new Set(['queryKey', 'key']);
const KEY_HOOKS = new Set(['useRead', 'useRecord', 'useResourceList']);
const CACHE_CALLS = new Set([
  'invalidateQueries',
  'refetchQueries',
  'setQueryData',
  'getQueryData',
  'removeQueries',
  'resetQueries',
  'cancelQueries',
]);
const PROBE = '\u0000probe';

// The kinds `queryKeys.ts` produces, each with the function that builds it.
export async function kindsOf(file: string): Promise<Map<string, string>> {
  const loaded: unknown = await import(file);
  const kinds = new Map<string, string>();
  if (typeof loaded !== 'object' || loaded === null) return kinds;
  for (const [name, member] of Object.entries(loaded)) {
    if (typeof member !== 'function' || !name.endsWith('Key')) continue;
    const key: unknown = (member as (...probes: string[]) => unknown)(PROBE, PROBE, PROBE);
    const kind: unknown = Array.isArray(key) ? key[0] : undefined;
    if (typeof kind === 'string' && /^[a-z][a-z-]*$/u.test(kind)) kinds.set(kind, name);
  }
  return kinds;
}

function through(node: ts.Node): ts.Node {
  let at = node;
  while (
    ts.isAsExpression(at.parent) ||
    ts.isSatisfiesExpression(at.parent) ||
    ts.isParenthesizedExpression(at.parent) ||
    ts.isNonNullExpression(at.parent)
  ) {
    at = at.parent;
  }
  return at;
}

function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
}

function propertyName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

function isKey(array: ts.ArrayLiteralExpression): boolean {
  const outer = through(array);
  const { parent } = outer;
  if (ts.isPropertyAssignment(parent) && parent.initializer === outer) {
    return KEY_PROPERTIES.has(propertyName(parent.name) ?? '');
  }
  if (ts.isCallExpression(parent) && parent.arguments[0] === outer) {
    const name = calleeName(parent);
    return name !== null && (KEY_HOOKS.has(name) || CACHE_CALLS.has(name));
  }
  return false;
}

function isScanned(file: string): boolean {
  return (
    /\.tsx?$/u.test(file) &&
    !/\.test\.tsx?$/u.test(file) &&
    !file.endsWith('.d.ts') &&
    !file.startsWith('src/testing/') &&
    file !== KEYS_FILE
  );
}

// `files` maps a path relative to the console root to its text; `kinds` maps
// each kind literal to the function that builds it.
export function violations(files: Map<string, string>, kinds: Map<string, string>): string[] {
  const found: string[] = [];
  for (const [file, text] of files) {
    if (!isScanned(file)) continue;
    const tree = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const report = (node: ts.Node, what: string): void => {
      const { line } = tree.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${file}:${String(line + 1)}: ${what}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isArrayLiteralExpression(node)) {
        const first = node.elements[0];
        const kind = first !== undefined && ts.isStringLiteralLike(first) ? first.text : null;
        const builder = kind === null ? undefined : kinds.get(kind);
        if (isKey(node)) {
          report(
            node,
            builder === undefined
              ? 'a hand-typed query key; add a function for it to shared/repository/queryKeys'
              : `a hand-typed query key; build it with ${builder} from shared/repository/queryKeys`,
          );
        } else if (builder !== undefined) {
          report(node, `an array starting with '${kind ?? ''}', which ${builder} builds`);
        }
      }
      if (
        ts.isCallExpression(node) &&
        calleeName(node) === 'invalidateQueries' &&
        ts.isPropertyAccessExpression(node.expression) &&
        !INVALIDATORS.has(file)
      ) {
        report(node, 'invalidateQueries called directly; use useInvalidate or useAfterChange');
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
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

const FIXTURE_KINDS = new Map([
  ['list', 'listKey'],
  ['record', 'recordKey'],
]);

describe('console cache keys', { timeout: 60_000 }, () => {
  it('are built by queryKeys, and invalidated through its wrappers', async () => {
    const files = await read(CONSOLE);
    const kinds = await kindsOf(path.join(REPO_ROOT, CONSOLE, KEYS_FILE));
    expect(kinds.get('list')).toBe('listKey');
    expect(kinds.get('record')).toBe('recordKey');
    expect(kinds.get('held-capabilities')).toBe('heldCapabilitiesKey');
    expect(kinds.get('evaluate')).toBe('evaluateKey');
    expect(kinds.has('system-issuer')).toBe(true);
    expect([...files.keys()]).toContain('src/shared/repository/useInvalidate.ts');
    expect(violations(files, kinds)).toEqual([]);
  });

  it('pass every conforming fixture', async () => {
    const files = await read(`${FIXTURES}/pass`);
    expect(files.size).toBeGreaterThan(3);
    expect(violations(files, FIXTURE_KINDS)).toEqual([]);
  });

  it('fail every non-conforming fixture, naming the file and the line', async () => {
    const files = await read(`${FIXTURES}/fail`);
    expect(files.size).toBeGreaterThan(3);
    const typed = 'a hand-typed query key;';
    expect(violations(files, FIXTURE_KINDS)).toEqual([
      "src/features/roles/repository/useAfter.ts:6: an array starting with 'list', which listKey builds",
      'src/features/roles/repository/useAfter.ts:7: invalidateQueries called directly; use useInvalidate or useAfterChange',
      `src/features/roles/repository/useKeys.ts:10: ${typed} add a function for it to shared/repository/queryKeys`,
      `src/features/roles/repository/useKeys.ts:6: ${typed} build it with listKey from shared/repository/queryKeys`,
      `src/features/roles/repository/useKeys.ts:7: ${typed} add a function for it to shared/repository/queryKeys`,
      `src/features/roles/repository/useKeys.ts:8: ${typed} build it with recordKey from shared/repository/queryKeys`,
      `src/features/roles/repository/useKeys.ts:9: ${typed} add a function for it to shared/repository/queryKeys`,
      `src/features/roles/repository/useReads.ts:4: ${typed} build it with recordKey from shared/repository/queryKeys`,
    ]);
  });
});
