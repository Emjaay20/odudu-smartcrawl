import { readFile, glob } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURES = path.join(import.meta.dirname, 'fixtures/literals');

// A user-facing sentence is an entry in a catalogue (ADR 0043). This reads each
// `*-html.ts` renderer and the mail templates as TypeScript and reports text a
// person would read that is typed in the file. Out of scope by kind, with no
// allowlist or waiver: the RFC 9457 problem-details strings of console-gateway
// and protocol-admin, which a program reads, and developer-facing protocol text
// such as an `error_description`.

export interface Finding {
  readonly line: number;
  readonly text: string;
  readonly where: 'text' | 'attribute' | 'script' | 'title';
}

// What it cannot see, so green speaks only for the rest: text built in a route
// or usecase and passed in (the second check catches the one form that has
// happened, a `.message` handed to a renderer); a literal in a helper that is
// not a `*-html.ts`; text concatenated across statements or files; a one-word
// lower-case string outside markup, which reads as an identifier; the `value`
// of a `<button>`, which is what the form submits; a script sentence that
// arrives through a variable.

const BLANK = String.fromCodePoint(0xfffc);
const LETTERS = /\p{L}{2}/u;
const PROSE_ARGUMENT_CALLS = new Set(['page', 'escapeHtml', 'bdi']);
const TEXT_ATTRIBUTES = new Set(['alt', 'title', 'placeholder', 'aria-label']);
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

function calleeName(call: ts.CallExpression): string {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return '';
}

function isStringish(node: ts.Node): boolean {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  );
}

function isConcatenation(node: ts.Node): node is ts.BinaryExpression {
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;
}

function containsStringish(node: ts.Node): boolean {
  if (isStringish(node)) return true;
  if (ts.isParenthesizedExpression(node)) return containsStringish(node.expression);
  return isConcatenation(node) && (containsStringish(node.left) || containsStringish(node.right));
}

// The text of one string expression with every `${...}` and every operand that
// is not a literal blanked, plus the sub-expressions that may hold literals.
function assemble(node: ts.Expression, inner: ts.Expression[]): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      inner.push(span.expression);
      text += BLANK + span.literal.text;
    }
    return text;
  }
  if (ts.isParenthesizedExpression(node)) return assemble(node.expression, inner);
  if (isConcatenation(node)) return assemble(node.left, inner) + assemble(node.right, inner);
  inner.push(node);
  return BLANK;
}

function isProse(text: string): boolean {
  const bare = text.replaceAll(BLANK, ' ').replace(/&[#\w]+;/gu, ' ');
  return LETTERS.test(bare);
}

// Outside markup a string is code as often as text, so only what reads as a
// sentence or a capitalised word counts.
function readsAsText(text: string): boolean {
  const bare = text.replaceAll(BLANK, ' ').trim();
  return /\p{L}{2,}\s+\p{L}{2,}/u.test(bare) || /^\p{Lu}\p{Ll}+/u.test(bare);
}

function lineIn(text: string, index: number, start: number): number {
  let line = start;
  for (let at = 0; at < index; at += 1) if (text[at] === '\n') line += 1;
  return line;
}

function inspect(text: string, start: number): Finding[] {
  const found: Finding[] = [];
  const quoted = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/gu;
  const scripts = /<script\b[^>]*>([\s\S]*?)<\/script>/giu;
  let rest = text;
  for (const script of text.matchAll(scripts)) {
    const body = script[1] ?? '';
    const bodyStart = script.index + script[0].indexOf(body);
    for (const string of body.matchAll(quoted)) {
      const value = string[2] ?? '';
      if (readsAsText(value))
        found.push({
          line: lineIn(text, bodyStart + string.index, start),
          text: value,
          where: 'script',
        });
    }
    rest = rest.replace(script[0], (whole) => whole.replace(/[^\n]/gu, ' '));
  }

  if (!/[<>]/u.test(rest)) {
    if (readsAsText(rest)) found.push({ line: start, text: rest.trim(), where: 'text' });
    return found;
  }

  for (const tag of rest.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/gu)) {
    const name = (tag[1] ?? '').toLowerCase();
    const attributes = tag[2] ?? '';
    const type = /\btype\s*=\s*["']?(submit|button|reset)/iu.test(attributes);
    for (const attribute of attributes.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
      const key = (attribute[1] ?? '').toLowerCase();
      const value = attribute[2] ?? attribute[3] ?? '';
      const text = TEXT_ATTRIBUTES.has(key) || (key === 'value' && name === 'input' && type);
      if (text && isProse(value)) {
        found.push({
          line: lineIn(rest, tag.index, start),
          text: value,
          where: 'attribute',
        });
      }
    }
  }

  const nodes = rest.replace(/<[^>]*>/gu, '\u0001').split('\u0001');
  let offset = 0;
  for (const node of nodes) {
    if (isProse(node)) {
      found.push({
        line: lineIn(rest, rest.indexOf(node, offset), start),
        text: node.replaceAll(BLANK, '').trim(),
        where: 'text',
      });
    }
    offset += node.length;
  }
  return found;
}

function skipped(node: ts.Expression): boolean {
  const parent = node.parent;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isLiteralTypeNode(parent) || ts.isCaseClause(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) return true;
  if (ts.isTaggedTemplateExpression(parent)) return true;
  if (ts.isCallExpression(parent) && parent.arguments.includes(node)) {
    const prose = PROSE_ARGUMENT_CALLS.has(calleeName(parent));
    return !prose;
  }
  return false;
}

export function findLiterals(source: string, fileName = 'renderer.ts'): Finding[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const found: Finding[] = [];

  function visit(node: ts.Node): void {
    if (ts.isExpression(node) && containsStringish(node) && !ts.isParenthesizedExpression(node)) {
      const inner: ts.Expression[] = [];
      const text = assemble(node, inner);
      if (!skipped(node)) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        const asTitle =
          ts.isCallExpression(node.parent) &&
          calleeName(node.parent) === 'page' &&
          node.parent.arguments[0] === node;
        if (asTitle) {
          if (isProse(text)) found.push({ line, text, where: 'title' });
        } else {
          found.push(...inspect(text, line));
        }
      }
      for (const expression of inner) visit(expression);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

describe('findLiterals', () => {
  it('reports the text of a page typed in the renderer, with its line', async () => {
    const source = await readFile(path.join(FIXTURES, 'bad-html.ts'), 'utf8');
    const found = findLiterals(source);
    expect(found.map((finding) => [finding.line, finding.text])).toEqual([
      [6, 'Sign in'],
      [7, 'Welcome back'],
      [8, 'Hello'],
    ]);
  });

  it('passes a renderer whose every sentence comes from the catalogue', async () => {
    const source = await readFile(path.join(FIXTURES, 'good-html.ts'), 'utf8');
    expect(findLiterals(source)).toEqual([]);
  });

  it('reports a sentence inside a script body', async () => {
    const source = await readFile(path.join(FIXTURES, 'script-html.ts'), 'utf8');
    const found = findLiterals(source);
    expect(found.map((finding) => [finding.where, finding.text])).toEqual([
      ['script', 'Something went wrong'],
    ]);
  });

  it('reassembles text split across concatenation and template spans', async () => {
    const source = await readFile(path.join(FIXTURES, 'split-html.ts'), 'utf8');
    const found = findLiterals(source);
    expect(found.map((finding) => finding.text)).toEqual(['Please wait', 'Please wait']);
  });

  it('reports a literal title passed to page()', async () => {
    const source = await readFile(path.join(FIXTURES, 'page-title-html.ts'), 'utf8');
    expect(findLiterals(source).map((finding) => [finding.where, finding.text])).toEqual([
      ['title', 'Account settings'],
    ]);
  });

  it('reports alt, title, placeholder, aria-label and the value of an input that submits', async () => {
    const source = await readFile(path.join(FIXTURES, 'attributes-html.ts'), 'utf8');
    const found = findLiterals(source)
      .filter((finding) => finding.where === 'attribute')
      .map((finding) => finding.text);
    expect(found).toEqual([
      'Company logo',
      'Open the page',
      'Your name',
      'Close dialog',
      'Send now',
    ]);
  });

  it('ignores comments, import paths, property names and comparisons', () => {
    const source = `import { x } from 'some-package';
// A sentence in a comment.
/* Another one. */
const key = { 'content-type': 1 };
export const same = (v: string) => v === 'hello world';`;
    expect(findLiterals(source)).toEqual([]);
  });
});

const REQUEST_ERROR_HELPER = /^(render[A-Z]\w*|send\w*Error\w*)$/u;

// A domain value's `.message` is developer-facing English: a view maps the
// value's code to a sentence of its own catalogue instead. Handing the message
// to a renderer or to a request-error helper puts it in front of a person.
export function findMessageLeaks(source: string, fileName = 'route.ts'): Finding[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const found: Finding[] = [];

  function messages(node: ts.Node, call: ts.CallExpression): void {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'message') {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      found.push({ line, text: `${calleeName(call)}(... ${node.getText(file)})`, where: 'text' });
    }
    ts.forEachChild(node, (child) => {
      messages(child, call);
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && REQUEST_ERROR_HELPER.test(calleeName(node))) {
      for (const argument of node.arguments) messages(argument, node);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

describe('findMessageLeaks', () => {
  it('reports a .message handed to a renderer or a request-error helper', async () => {
    const source = await readFile(path.join(FIXTURES, 'message-leak-html.ts'), 'utf8');
    expect(findMessageLeaks(source).map((finding) => finding.line)).toEqual([6, 7]);
  });

  it('passes a violation handed over whole and a message read for other ends', async () => {
    const source = await readFile(path.join(FIXTURES, 'message-clean-html.ts'), 'utf8');
    expect(findMessageLeaks(source)).toEqual([]);
  });
});

async function repoFiles(pattern: string): Promise<string[]> {
  const found: string[] = [];
  for await (const file of glob(pattern, {
    cwd: REPO_ROOT,
    exclude: (entry) => path.basename(entry) === 'node_modules',
  })) {
    if (!file.endsWith('.test.ts')) found.push(file);
  }
  return found.sort();
}

describe('the server renderers and mail templates', () => {
  it('finds no user-facing literal in any server renderer', async () => {
    const files = [
      ...(await repoFiles('packages/*/src/view/*-html.ts')),
      'packages/email/src/service/templates.ts',
    ];
    expect(files.length).toBeGreaterThan(14);

    const offences: string[] = [];
    for (const file of files) {
      const source = await readFile(path.join(REPO_ROOT, file), 'utf8');
      for (const finding of findLiterals(source, file)) {
        offences.push(`${file}:${String(finding.line)} ${finding.where}: ${finding.text}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('hands no .message of a domain value to a renderer or a request-error helper', async () => {
    const packages = new Set(
      (await repoFiles('packages/*/src/view/*-html.ts')).map((file) => file.split('/')[1]),
    );
    const files: string[] = [];
    for (const name of packages) {
      files.push(
        ...(await repoFiles(`packages/${String(name)}/src/view/*-html.ts`)),
        ...(await repoFiles(`packages/${String(name)}/src/view/routes/*.ts`)),
      );
    }
    expect(files.length).toBeGreaterThan(20);

    const offences: string[] = [];
    for (const file of files) {
      const source = await readFile(path.join(REPO_ROOT, file), 'utf8');
      for (const finding of findMessageLeaks(source, file)) {
        offences.push(`${file}:${String(finding.line)} ${finding.text}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
