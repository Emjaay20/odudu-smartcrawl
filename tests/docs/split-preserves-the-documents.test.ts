import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PAGES,
  at,
  CONSOLE_PAGES,
  loadDocument,
  loadPages,
  PROTOCOL_PAGES,
  REPO_ROOT,
  scanFences,
  sections,
  type Document,
} from './markdown.js';

// The three path documents became directories of pages. Nothing but the page
// boundaries, the front matter and the targets of links may have changed, so
// a split that loses, repeats or reorders a line fails here. Each document's
// opening, which describes how it was captured, now lives on one contributing
// page and each group's index is written for readers; the opening is held to
// that page instead.
const CAPTURE_NOTES = 'apps/docs/content/en/contributing/transcripts.md';
const SPLITS = [
  {
    original: 'docs/request-paths.md',
    pages: PROTOCOL_PAGES,
    leftBehind: 'What is not implemented',
  },
  { original: 'docs/admin-paths.md', pages: ADMIN_PAGES, leftBehind: null },
  { original: 'docs/console-paths.md', pages: CONSOLE_PAGES, leftBehind: null },
] as const;

const TOTAL_REPOSITORY_LINKS = 30;
// Prettier pads a table to its widest cell, and a retargeted link changes the width.
const TABLE_ROW = /^\s*\|.*$/u;
const cells = (row: string): string =>
  row
    .replaceAll(/\s+/gu, ' ')
    .replaceAll(/ ?\| ?/gu, '|')
    .replaceAll(/-+/gu, '-');
const LINK_TARGET = /\]\([^)\s]*\)/gu;
const REPOSITORY_FILE = /^https:\/\/github\.com\/wizzywit\/odudu\/blob\/main\/(?<file>[^#]+)/u;

function opening(document: Document): readonly string[] {
  const first = sections(document, 1)[0]?.headingLine;
  if (first === undefined) throw new Error(`${document.name} has no sections`);
  return document.lines.slice(0, first - 1);
}

function without(document: Document, heading: string): readonly string[] {
  const found = sections(document, 1);
  const index = found.findIndex((section) => section.heading === heading);
  const start = found[index]?.headingLine;
  if (start === undefined) throw new Error(`${document.name} has no section "${heading}"`);
  const end = found[index + 1]?.headingLine ?? document.lines.length + 1;
  return [...document.lines.slice(0, start - 1), ...document.lines.slice(end - 1)];
}

// Blank lines between blocks collapse to one and the ends are trimmed, because
// a page ends where its section does; a blank line inside a fenced block is
// part of the transcript and is kept as it is.
function comparable(lines: readonly string[]): string[] {
  const { fenced } = scanFences({ name: 'comparable', lines });
  const kept: string[] = [];
  let previousBlank = true;
  for (const [index, line] of lines.entries()) {
    if (fenced[index] === true) {
      kept.push(line);
      previousBlank = false;
      continue;
    }
    if (line.trim() === '') {
      if (!previousBlank) kept.push('');
      previousBlank = true;
      continue;
    }
    kept.push(line.replace(LINK_TARGET, '](target)').replace(TABLE_ROW, cells));
    previousBlank = false;
  }
  while (kept.at(-1) === '') kept.pop();
  return kept;
}

function pagesOf(directory: string): string[] {
  return readdirSync(path.join(REPO_ROOT, directory))
    .filter((name) => name.endsWith('.md'))
    .sort();
}

function difference(expected: readonly string[], actual: readonly string[]): string {
  const index = expected.findIndex((line, position) => line !== actual[position]);
  if (index !== -1) {
    return `line ${String(index + 1)}: expected ${JSON.stringify(expected[index])}, got ${JSON.stringify(actual[index])}`;
  }
  return actual.length === expected.length
    ? 'identical'
    : `the pages hold ${String(actual.length - expected.length)} extra lines`;
}

function repositoryLinks(document: Document): { line: number; target: string }[] {
  const { fenced } = scanFences(document);
  return document.lines.flatMap((line, index) =>
    fenced[index] === true
      ? []
      : [...line.matchAll(/\]\((?<target>https:\/\/github\.com[^)\s]*)\)/gu)].map((match) => ({
          line: index + 1,
          target: match.groups?.target ?? '',
        })),
  );
}

describe.each(SPLITS)('$original split into $pages', ({ original, pages, leftBehind }) => {
  const source = loadDocument(original);
  const pageDocument = loadPages(pages);
  const afterIndex = pageDocument.sources?.[1]?.fromLine;
  if (afterIndex === undefined) throw new Error(`${pages} has no page after its index`);

  it(`has every line of ${original} after its opening in a page, in order`, () => {
    const whole = leftBehind === null ? source.lines : without(source, leftBehind);
    const expected = comparable(whole.slice(opening(source).length));
    const actual = comparable(pageDocument.lines.slice(afterIndex - 1));

    expect(difference(expected, actual)).toBe('identical');
  });

  it(`holds the opening of ${original} on the contributing page, in order`, () => {
    const lede = opening(source).slice(2);
    const expected = comparable(lede);
    const notes = comparable(loadDocument(CAPTURE_NOTES).lines);
    const start = notes.findIndex((line) => line === expected[0]);

    expect(start).toBeGreaterThan(-1);
    expect(difference(expected, notes.slice(start, start + expected.length))).toBe('identical');
  });

  it('lists every page in order.json, and only pages that exist', () => {
    const listed: unknown = JSON.parse(
      readFileSync(path.join(REPO_ROOT, pages, 'order.json'), 'utf8'),
    );

    expect([...(listed as string[])].sort()).toEqual(pagesOf(pages));
    expect((listed as string[])[0]).toBe('index.md');
  });

  it('gives every page a title and a description in its front matter', () => {
    const missing = pagesOf(pages).filter((name) => {
      const head = /^---\n(?<yaml>[\s\S]*?)\n---\n/u.exec(
        readFileSync(path.join(REPO_ROOT, pages, name), 'utf8'),
      )?.groups?.yaml;
      return head === undefined || !/^title: ./mu.test(head) || !/^description: ./mu.test(head);
    });

    expect(missing).toEqual([]);
  });

  it('holds only Markdown pages, which the build reads as CommonMark', () => {
    const others = readdirSync(path.join(REPO_ROOT, pages)).filter(
      (name) => !name.endsWith('.md') && name !== 'order.json',
    );

    expect(others).toEqual([]);
  });

  it('points every link outside the site at a repository file that exists', () => {
    const missing = repositoryLinks(pageDocument)
      .filter(({ target }) => {
        const file = REPOSITORY_FILE.exec(target)?.groups?.file;
        return file === undefined || !existsSync(path.join(REPO_ROOT, file));
      })
      .map(({ line, target }) => `${at(pageDocument, line)} ${target}`);

    expect(missing).toEqual([]);
  });
});

it('keeps the links the pages made to files the site does not hold', () => {
  const total = SPLITS.reduce(
    (count, { pages }) => count + repositoryLinks(loadPages(pages)).length,
    0,
  );

  expect(total).toBeGreaterThanOrEqual(TOTAL_REPOSITORY_LINKS);
});

describe('the pages read as one document', () => {
  it('cites the page and its own line, not the concatenation, for a line of a later page', () => {
    const document = loadPages(PROTOCOL_PAGES);
    const second = document.sources?.[1];
    if (second === undefined) throw new Error('the protocol pages have no second page');

    expect(document.name).toBe(PROTOCOL_PAGES);
    expect(second.fromLine).toBeGreaterThan(1);
    expect(document.lines[second.fromLine - 1]).toMatch(/^## /u);
    expect(second.pageLine).toBeGreaterThan(1);
  });
});
