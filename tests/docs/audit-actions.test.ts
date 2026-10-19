import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_MUTATION_ACTIONS, AUDIT_ACTIONS } from '../../packages/domain-audit/src/index.js';
import { REPO_ROOT } from './markdown.js';

// The types already refuse an `admin_mutation` action outside the tuple. This
// is the second check: every action literal any production source writes is on
// the events page's list, and each listed action is still written somewhere.
const SOURCES = globSync('{packages/*/src,apps/server/src}/**/*.ts', {
  cwd: REPO_ROOT,
  exclude: (entry) => entry.endsWith('.test.ts') || entry.includes('/testing/'),
}).filter((file) => !file.includes('packages/domain-audit/src/service/'));

const VOCABULARY = new Set<string>(Object.values(AUDIT_ACTIONS).flat());

function written(): { literals: Set<string>; text: string } {
  const text = SOURCES.map((file) => readFileSync(path.join(REPO_ROOT, file), 'utf8')).join('\n');
  const literals = new Set<string>();
  for (const match of text.matchAll(/action:\s*'([a-z_]+\.[a-z_]+)'/gu)) {
    if (match[1] !== undefined) literals.add(match[1]);
  }
  return { literals, text };
}

describe('the admin mutation actions the events page lists', () => {
  it('include every action literal a production source writes', () => {
    const { literals } = written();
    expect(SOURCES.length).toBeGreaterThan(100);
    const known = new Set<string>([...ADMIN_MUTATION_ACTIONS, ...VOCABULARY]);
    expect([...literals].filter((action) => !known.has(action))).toEqual([]);
  });

  it('are each still written by a source', () => {
    const { text } = written();
    expect(ADMIN_MUTATION_ACTIONS.filter((action) => !text.includes(`'${action}'`))).toEqual([]);
  });
});
