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

// The transcripts were cut from three single documents and are now only
// pages, so there is no original left to compare a page against. What stays
// checked is the shape the build and the other tests read them by: the order
// list, front matter, Markdown only, and links to repository files that exist.
// A page that loses transcript content is caught by apps/docs/tests/
// transcripts.test.ts, which holds every fenced block to the built page, and
// by the checks that read a recorded response out of the pages.
const GROUPS = [
  { pages: PROTOCOL_PAGES, fencedBlocks: 656 },
  { pages: ADMIN_PAGES, fencedBlocks: 616 },
  { pages: CONSOLE_PAGES, fencedBlocks: 161 },
] as const;

const TOTAL_REPOSITORY_LINKS = 26;
const REPOSITORY_FILE = /^https:\/\/github\.com\/wizzywit\/odudu\/blob\/main\/(?<file>[^#]+)/u;

function pagesOf(directory: string): string[] {
  return readdirSync(path.join(REPO_ROOT, directory))
    .filter((name) => name.endsWith('.md'))
    .sort();
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

describe.each(GROUPS)('the pages of $pages', ({ pages, fencedBlocks }) => {
  const pageDocument = loadPages(pages);

  it('holds every recorded block it held when the originals were retired', () => {
    expect(scanFences(pageDocument).spans.length).toBeGreaterThanOrEqual(fencedBlocks);
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

it('keeps the links the pages make to files the site does not hold', () => {
  const total = GROUPS.reduce(
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

describe('the contributing page that says how the transcripts were captured', () => {
  it('keeps one section for each group of transcripts', () => {
    const headings = sections(loadDocument('apps/docs/content/en/contributing/transcripts.md'), 3)
      .map((section) => section.heading)
      .sort();

    expect(headings).toEqual([
      'Admin path transcripts',
      'Console path transcripts',
      'Request path transcripts',
    ]);
  });
});

// A transcript page is read by someone looking up a route, not by the person
// who recorded it. Which stack a run used, which commit it was built from and
// which source file implements the behaviour belong on the contributing page
// or in the code; on a page they are noise a reader must step over.
const ORDINAL =
  '(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|' +
  'thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|' +
  'twenty-(?:first|second|third))';
const CONTRIBUTOR_PROSE: readonly (readonly [RegExp, string])[] = [
  [/\bre-?captured\b/iu, 'a recapture note'],
  // "captured against a stack driven only as far as Path A" names the state a
  // transcript depends on, which is required; a date, a run or a project is not.
  [/\bcaptured (?:on|against|again)\b(?! an? )/iu, 'a note on where it was captured'],
  [new RegExp(`\\b${ORDINAL} stack\\b`, 'iu'), 'an ordinal stack'],
  [/\b(?:compose )?project `?odudu-[\w-]+/iu, 'a compose project name'],
  [/-p odudu-[\w-]+/u, 'a compose project flag'],
  [/\bcompose project\b/iu, 'a compose project'],
  [/\bnote at the top of this (?:document|page)\b/iu, 'a pointer to a note that is gone'],
  [/\btorn down\b/iu, 'a teardown note'],
  [/\bbuilt from (?:the )?(?:tree|commit|branch)\b/iu, 'a build provenance note'],
  [/`[0-9a-f]{8}`/u, 'a commit hash'],
  [/(?<![\w/.-])(?:packages|apps|tests)\/[\w./@{}*-]+/u, 'a repository source path'],
];

function proseOf(file: string): { line: number; text: string }[] {
  const document = loadDocument(file);
  const { fenced } = scanFences(document);
  return document.lines.flatMap((text, index) =>
    fenced[index] === true
      ? []
      : [{ line: index + 1, text: text.replaceAll(/\]\([^)\s]*\)/gu, '](link)') }],
  );
}

describe.each(GROUPS)(
  'the prose of $pages is written for a reader of the reference',
  ({ pages }) => {
    it('holds no note about how it was recorded and no path into the source', () => {
      const order = loadPages(pages).sources ?? [];
      const found: string[] = [];
      for (const { file } of order) {
        const relative = path.relative(REPO_ROOT, path.join(REPO_ROOT, file));
        for (const { line, text } of proseOf(relative)) {
          for (const [pattern, what] of CONTRIBUTOR_PROSE) {
            if (pattern.test(text)) found.push(`${relative}:${String(line)} has ${what}`);
          }
        }
      }

      expect(found).toEqual([]);
    });
  },
);
