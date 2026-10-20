import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DEFINED } from '#docs/tests/support/console-labels.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const REPO = path.resolve(DOCS_ROOT, '../..');
const CONTENT = path.join(DOCS_ROOT, 'content/en');
const CONSOLE_PAGES = readdirSync(path.join(CONTENT, 'admin-console')).map(
  (name) => `admin-console/${name}`,
);
const PAGES = ['quick-start/index.mdx', ...CONSOLE_PAGES];

const read = (file: string): string => readFileSync(path.join(REPO, file), 'utf8');

// The source with its comments blanked, so a label that survives only in a
// comment does not count as rendered. JSX text is left alone: `//` in it is words.
export function withoutComments(source: string, file = 'source.tsx'): string {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const spans: [number, number][] = [];
  const words: [number, number][] = [];
  const collect = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      words.push([node.getStart(), node.getEnd()]);
      return;
    }
    for (const range of [
      ...(ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(source, node.getEnd()) ?? []),
    ]) {
      spans.push([range.pos, range.end]);
    }
    ts.forEachChild(node, collect);
  };
  collect(parsed);
  return spans
    .filter(([from]) => !words.some(([start, end]) => from >= start && from < end))
    .sort((a, b) => b[0] - a[0])
    .reduce(
      (text, [from, to]) => text.slice(0, from) + ' '.repeat(to - from) + text.slice(to),
      source,
    );
}
// Markup breaks a line wherever it likes, so a snippet is looked for with every
// run of whitespace read as one space.
const squeezed = (text: string): string => text.replace(/\s+/gu, ' ');

export function expanded(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`\${${key}}`, value),
    template,
  );
}

// Each snippet is looked for in the one file that renders the control, so a
// word that appears elsewhere in the console cannot stand in for it.
function problems(source: (file: string) => string): string[] {
  const wrong: string[] = [];
  for (const [name, defined] of Object.entries(DEFINED)) {
    for (const { file, text } of defined.evidence) {
      if (!squeezed(withoutComments(source(file), file)).includes(squeezed(text))) {
        wrong.push(`${name}: ${file} does not hold ${text}`);
      }
    }
    if (defined.expand !== undefined) {
      const { template, values } = defined.expand;
      if (expanded(template, values) !== name) wrong.push(`${name}: expands to something else`);
    }
  }
  return wrong;
}

function quotedIn(page: string): string[] {
  const prose = readFileSync(path.join(CONTENT, page), 'utf8').replace(
    /^(`{3,})[\s\S]*?^\1$/gmu,
    '',
  );
  return [...prose.matchAll(/\*\*([^*]+)\*\*/gu)].map((match) => match[1] ?? '');
}

const quoted = (): string[] => PAGES.flatMap(quotedIn);

describe('the names the pages quote from the console', () => {
  it('finds the names, so a changed quotation mark fails rather than passing vacuously', () => {
    expect(quotedIn('quick-start/index.mdx').length).toBeGreaterThan(15);
    for (const page of CONSOLE_PAGES.filter((name) => name !== 'admin-console/index.md')) {
      expect(quotedIn(page).length, page).toBeGreaterThan(3);
    }
  });

  it('are each in the table, so a new quotation is read against its screen', () => {
    const missing = PAGES.flatMap((page) =>
      quotedIn(page)
        .filter((name) => DEFINED[name] === undefined)
        .map((name) => `${page}: ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it('are each defined where the table says, by exactly that text', () => {
    expect(problems(read)).toEqual([]);
  });

  it('lists no name the pages do not quote', () => {
    const names = new Set(quoted());
    expect(Object.keys(DEFINED).filter((name) => !names.has(name))).toEqual([]);
  });

  it('fails when the console renames a control, and for a name no screen defines', () => {
    const renamed = (file: string): string =>
      file.endsWith('NewClientPage.tsx')
        ? read(file).replace('label="Kind"', 'label="Type"')
        : read(file);
    expect(problems(renamed).filter((problem) => problem.startsWith('Kind:'))).toHaveLength(1);
    expect(problems(read)).toEqual([]);
    expect(DEFINED['Create a widget']).toBeUndefined();
  });

  it('does not count a label that survives only in a comment', () => {
    const only = (file: string): string =>
      file.endsWith('NewClientPage.tsx')
        ? read(file).replace('label="Kind"', '// label="Kind"')
        : read(file);
    expect(problems(only).filter((problem) => problem.startsWith('Kind:'))).toHaveLength(1);
    expect(withoutComments('const a = "x"; // "y"\n/* "z" */ const b = <p>// "w"</p>;')).toContain(
      '// "w"',
    );
  });
});
