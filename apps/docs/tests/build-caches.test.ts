import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearBuildCaches } from '#docs/tests/support/build.ts';

let root = '';

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('clearBuildCaches', () => {
  it("removes what bakes one target's base into the next build and keeps a fixture tree", () => {
    root = mkdtempSync(path.join(tmpdir(), 'odudu-docs-caches-'));
    for (const dir of [
      '.docusaurus',
      'node_modules/.cache/rspack',
      'node_modules/.cache/fixture',
    ]) {
      mkdirSync(path.join(root, dir), { recursive: true });
      writeFileSync(path.join(root, dir, 'file'), 'x');
    }
    clearBuildCaches(root);
    expect(existsSync(path.join(root, '.docusaurus'))).toBe(false);
    expect(existsSync(path.join(root, 'node_modules/.cache/rspack'))).toBe(false);
    expect(existsSync(path.join(root, 'node_modules/.cache/fixture/file'))).toBe(true);
  });

  it('is quiet when there is nothing to remove', () => {
    root = mkdtempSync(path.join(tmpdir(), 'odudu-docs-caches-'));
    expect(() => {
      clearBuildCaches(root);
    }).not.toThrow();
  });
});
