import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './markdown.js';

// A page that says the roadmap names or places something is wrong the day
// the roadmap does not. This checks the capabilities pages have named so far,
// not every sentence: a new term goes in the list when a page first uses it.
const CAPABILITIES: Record<string, RegExp> = {
  SCIM: /\bSCIM\b/u,
  LDAP: /\bLDAP\b/u,
  SAML: /\bSAML\b/u,
  'inbound provisioning': /inbound provisioning/iu,
  MCP: /\bMCP\b/u,
  '10,000 users': /10,000/u,
};

const SITE = 'apps/docs/content/en';
const roadmap = readFileSync(path.join(REPO_ROOT, SITE, 'roadmap.md'), 'utf8');
const pages = globSync(`${SITE}/**/*.md`, {
  cwd: REPO_ROOT,
  exclude: (entry) =>
    entry.includes('/generated') ||
    entry.includes('/transcripts') ||
    entry.endsWith('roadmap.md') ||
    entry.includes('/contributing/'),
});

describe('what the pages say the roadmap names', () => {
  it('finds the pages that mention the roadmap', () => {
    const mentioning = pages.filter((page) =>
      /roadmap/iu.test(readFileSync(path.join(REPO_ROOT, page), 'utf8')),
    );
    expect(mentioning.length).toBeGreaterThan(3);
  });

  it('is backed, for each capability a sentence about the roadmap names', () => {
    const unbacked: string[] = [];
    for (const page of pages) {
      const text = readFileSync(path.join(REPO_ROOT, page), 'utf8');
      for (const sentence of text.split(/(?<=[.!?])\s+/u)) {
        if (!/roadmap/iu.test(sentence)) continue;
        for (const [name, pattern] of Object.entries(CAPABILITIES)) {
          if (pattern.test(sentence) && !pattern.test(roadmap)) unbacked.push(`${page}: ${name}`);
        }
      }
    }
    expect(unbacked).toEqual([]);
  });
});
