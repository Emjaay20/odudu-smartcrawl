import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { GENERATED_DIRS } from '#docs/scripts/generate.ts';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

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
