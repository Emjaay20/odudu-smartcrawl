import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// A component's props are read, never written, and `readonly` says so in the
// type. Found in a .tsx file of the docs app's src (tests excepted): a component
// (a function named with a capital letter) whose first parameter is destructured or typed, with a property
// that is not `readonly`, whether the type is written inline, is an interface
// or type alias of the same file, or is missing (destructured and untyped).
// `Readonly<…>` is accepted. Not seen: a props type imported from another
// file, a type alias of a union, and members inherited through `extends`.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS = 'apps/docs';
const FIXTURES = 'tests/lint/fixtures/docs-props-readonly';

type Declared = Map<string, ts.TypeElement[]>;

function declaredShapes(tree: ts.SourceFile): Declared {
  const shapes: Declared = new Map();
  for (const statement of tree.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      shapes.set(statement.name.text, [...statement.members]);
    } else if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
      shapes.set(statement.name.text, [...statement.type.members]);
    }
  }
  return shapes;
}

function isReadonly(member: ts.TypeElement): boolean {
  return (
    ts.isPropertySignature(member) &&
    (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Readonly) !== 0
  );
}

function writable(members: readonly ts.TypeElement[]): ts.TypeElement[] {
  return members.filter((member) => ts.isPropertySignature(member) && !isReadonly(member));
}

function membersOf(type: ts.TypeNode, shapes: Declared): readonly ts.TypeElement[] {
  if (ts.isTypeLiteralNode(type)) return type.members;
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    return shapes.get(type.typeName.text) ?? [];
  }
  return [];
}

function lineOf(tree: ts.SourceFile, node: ts.Node): number {
  return tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

// A component is a function named with a capital letter: a declaration, or the
// arrow or function expression a capitalised variable holds.
function isComponent(node: ts.Node): node is ts.FunctionLikeDeclaration {
  if (ts.isFunctionDeclaration(node)) return /^[A-Z]/u.test(node.name?.text ?? '');
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  return (
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name) &&
    /^[A-Z]/u.test(node.parent.name.text)
  );
}

function propsParameter(node: ts.Node): ts.ParameterDeclaration | undefined {
  if (!isComponent(node)) return undefined;
  const first = node.parameters[0];
  if (first === undefined) return undefined;
  return ts.isObjectBindingPattern(first.name) || first.type !== undefined ? first : undefined;
}

export function violations(files: Map<string, string>): string[] {
  const found: string[] = [];
  for (const [file, text] of files) {
    if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const shapes = declaredShapes(tree);
    const visit = (node: ts.Node): void => {
      const parameter = propsParameter(node);
      if (parameter !== undefined) {
        if (parameter.type === undefined) {
          found.push(
            `${file}:${String(lineOf(tree, parameter))}: props are destructured with no type`,
          );
        } else {
          for (const member of writable(membersOf(parameter.type, shapes))) {
            found.push(
              `${file}:${String(lineOf(tree, member))}: ${member.name?.getText(tree) ?? 'a prop'} is not readonly`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return found.sort();
}

async function read(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const file of glob('src/**/*.tsx', { cwd: path.join(REPO_ROOT, root) })) {
    const posix = file.split(path.sep).join('/');
    files.set(posix, await readFile(path.join(REPO_ROOT, root, file), 'utf8'));
  }
  return files;
}

describe('props in the docs app', { timeout: 60_000 }, () => {
  it('are readonly in every component', async () => {
    const files = await read(DOCS);
    const names = [...files.keys()];
    expect(names).toContain('src/features/landing/view/Scene/Scene.tsx');
    expect(names).toContain('src/shared/view/ConsoleShot/ConsoleShot.tsx');
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
    expect(violations(files)).toEqual([
      'src/Inline.tsx:1: title is not readonly',
      'src/Interface.tsx:2: label is not readonly',
      'src/Untyped.tsx:1: props are destructured with no type',
    ]);
  });
});
