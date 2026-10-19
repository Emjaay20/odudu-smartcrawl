import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AUDIT_QUERY_TOO_BROAD } from '@odudu/contracts/admin';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PROBLEM_TYPES,
  GENERIC_PROBLEM_SUMMARY,
  problemTypeUri,
} from '#/service/problem-types';

// The routes write a problem; descriptions elsewhere only mention one.
const ROUTES = path.resolve(import.meta.dirname, '../view');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

// What the routes write as a problem `type`: a fragment on about:blank.
function emitted(): Set<string> {
  const found = new Set<string>();
  for (const file of sources(ROUTES)) {
    for (const match of readFileSync(file, 'utf8').matchAll(/about:blank#([a-z][a-z-]*)/gu)) {
      if (match[1] !== undefined) found.add(match[1]);
    }
  }
  return found;
}

describe('the admin problem types', () => {
  it('lists every type the routes write and no other', () => {
    const fragments = emitted();
    fragments.add(AUDIT_QUERY_TOO_BROAD.slice('about:blank#'.length));
    expect([...Object.keys(ADMIN_PROBLEM_TYPES)].sort()).toEqual([...fragments].sort());
  });

  it('writes each type as the URI a client receives', () => {
    expect(problemTypeUri('last-administrator')).toBe('about:blank#last-administrator');
    expect(problemTypeUri('audit-query-too-broad')).toBe(AUDIT_QUERY_TOO_BROAD);
  });

  it('gives every type an HTTP status and a one-paragraph meaning', () => {
    for (const [name, entry] of Object.entries(ADMIN_PROBLEM_TYPES)) {
      expect(entry.status, name).toBeGreaterThanOrEqual(400);
      expect(entry.status, name).toBeLessThan(600);
      expect(entry.summary, name).toMatch(/^\S.*\.$/u);
      expect(entry.summary, name).not.toContain('\n');
    }
    expect(GENERIC_PROBLEM_SUMMARY).toContain('about:blank');
  });
});
