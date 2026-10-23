import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './markdown.js';

// tests/docs/questions.md holds real questions with the answer the built
// site gave. This holds its shape: a status, the pages that answer, and pages
// that exist. Whether an answer is still true is read again against a fresh
// build; a test cannot read it. Generated reference pages are not on a clean
// checkout, so they are accepted by their folder.

const CONTENT = path.join(REPO_ROOT, 'apps/docs/content/en');
const STATUSES = ['answered', 'partly', 'not'];

interface Question {
  readonly id: string;
  readonly role: string;
  readonly before: string;
  readonly status: string;
  readonly pages: readonly string[];
}

function questions(): Question[] {
  const text = readFileSync(path.join(REPO_ROOT, 'tests/docs/questions.md'), 'utf8');
  return text
    .split(/^## /mu)
    .slice(1)
    .map((block) => {
      const field = (name: string): string =>
        new RegExp(`^- ${name}: (.*)$`, 'mu').exec(block)?.[1]?.trim() ?? '';
      return {
        id: /^([A-Z]\d+)\./u.exec(block)?.[1] ?? '',
        role: field('Role'),
        before: field('Before'),
        status: field('Status'),
        pages: field('Pages')
          .split(',')
          .map((page) => page.trim())
          .filter((page) => page !== ''),
      };
    });
}

const pageExists = (page: string): boolean =>
  page.startsWith('reference/generated/') ||
  ['', '/index'].some((tail) =>
    ['.md', '.mdx'].some((extension) =>
      existsSync(path.join(CONTENT, `${page}${tail}${extension}`)),
    ),
  );

describe('the question bank', () => {
  const all = questions();

  it('holds between 60 and 80 questions, from every kind of reader', () => {
    expect(all.length).toBeGreaterThanOrEqual(60);
    expect(all.length).toBeLessThanOrEqual(80);
    expect(new Set(all.map((q) => q.role))).toEqual(
      new Set(['Developer', 'Administrator', 'Operator', 'Security reviewer']),
    );
  });

  it('gives each question a unique id, a status before and after, and a page when answered', () => {
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
    for (const q of all) {
      expect(STATUSES, q.id).toContain(q.status);
      expect(STATUSES, q.id).toContain(q.before);
      if (q.status === 'answered') expect(q.pages.length, q.id).toBeGreaterThan(0);
    }
  });

  it('names only pages that exist', () => {
    const missing = all.flatMap((q) =>
      q.pages.filter((page) => !pageExists(page)).map((page) => `${q.id}: ${page}`),
    );
    expect(missing).toEqual([]);
  });

  it('leaves no question partly answered or unanswered at release', () => {
    expect(all.filter((q) => q.status !== 'answered').map((q) => q.id)).toEqual([]);
  });
});
