import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GENERATED_DIRS } from './generate.ts';

const DOCS_ROOT = path.resolve(import.meta.dirname, '..');

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: DOCS_ROOT, encoding: 'utf8' });
}

describe('the generated reference', () => {
  it('keeps generated pages out of git', () => {
    for (const dir of GENERATED_DIRS) {
      const ignored = git('check-ignore', `${dir}/x`).trim();
      expect(ignored, dir).toBe(`${dir}/x`);
      expect(git('ls-files', dir).trim(), dir).toBe('');
    }
  });
});
