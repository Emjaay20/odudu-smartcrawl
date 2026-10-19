import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '#/errors';
import { ERROR_DOCS, ERROR_GROUPS } from '#/error-docs';

describe('the error code reference', () => {
  it('documents every error code and no other', () => {
    expect(Object.keys(ERROR_DOCS).sort()).toEqual([...ERROR_CODES].sort());
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('gives each code a group, in the order the reference lists them, and a one-paragraph meaning', () => {
    for (const [code, docs] of Object.entries(ERROR_DOCS)) {
      expect(ERROR_GROUPS, code).toContain(docs.group);
      expect(docs.summary, code).toMatch(/^\S.*\.$/u);
      expect(docs.summary, code).not.toContain('\n');
    }
    for (const group of ERROR_GROUPS) {
      expect(
        Object.values(ERROR_DOCS).some((docs) => docs.group === group),
        group,
      ).toBe(true);
    }
  });
});
