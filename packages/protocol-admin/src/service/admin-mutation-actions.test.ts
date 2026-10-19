import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AUDIT_ACTIONS } from '@odudu/domain-audit';
import { describe, expect, it } from 'vitest';
import { ADMIN_MUTATION_ACTIONS } from '#/service/admin-mutation-actions';

const SRC = path.resolve(import.meta.dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

// The actions this package names where it writes an `admin_mutation` row.
// An action built from a variable is not seen, so this is a floor: each
// route that records one names it as a literal.
function written(): string[] {
  const vocabulary = new Set<string>(Object.values(AUDIT_ACTIONS).flat());
  const found = new Set<string>();
  for (const file of sources(SRC)) {
    for (const match of readFileSync(file, 'utf8').matchAll(/action: '([a-z_]+\.[a-z_]+)'/gu)) {
      if (match[1] !== undefined && !vocabulary.has(match[1])) found.add(match[1]);
    }
  }
  return [...found].sort();
}

describe('the admin mutation actions', () => {
  it('lists every action the routes record and no other', () => {
    expect(Object.keys(ADMIN_MUTATION_ACTIONS).sort()).toEqual(written());
  });

  it('describes each in one sentence', () => {
    for (const [action, summary] of Object.entries(ADMIN_MUTATION_ACTIONS)) {
      expect(summary, action).toMatch(/^\S.*\.$/u);
      expect(summary, action).not.toContain('\n');
    }
  });
});
