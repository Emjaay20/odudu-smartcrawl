import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const AREAS = path.join(DOCS_ROOT, 'content/en/admin-console');

// A console page that names a thing a person does to a subject links the page
// of the admin API that holds the calls for it, since the subject's calls are
// split across four pages.
const NAMES: readonly [page: string, words: RegExp, area: string][] = [
  ['system-administrators.mdx', /admin capability/iu, 'subject-access'],
  ['roles.mdx', /giving a role to a person/iu, 'subject-access'],
  ['groups.mdx', /putting a person in a group/iu, 'subject-access'],
  ['sessions.mdx', /one person's sessions/iu, 'subject-sessions'],
];

describe('the console pages that name a subject operation', () => {
  it.each(NAMES)('%s links the area that holds it', (page, words, area) => {
    const text = readFileSync(path.join(AREAS, page), 'utf8');
    expect(text).toMatch(words);
    expect(text).toContain(`admin-api/${area}.md`);
  });
});
