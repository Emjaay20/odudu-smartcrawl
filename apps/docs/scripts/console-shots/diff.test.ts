import { describe, expect, it } from 'vitest';
import { unifiedDiff } from './diff.ts';

const names = { left: 'committed', right: 'captured' };

describe('unifiedDiff', () => {
  it('is empty for equal records', () => {
    expect(unifiedDiff('a\nb', 'a\nb', names)).toBe('');
  });

  it('shows a changed line with its neighbours and marks what went and what came', () => {
    const left = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'].join('\n');
    const right = ['one', 'two', 'three', 'FOUR', 'five', 'six', 'seven'].join('\n');
    expect(unifiedDiff(left, right, names, 1)).toBe(
      ['--- committed', '+++ captured', ' three', '-four', '+FOUR', ' five'].join('\n'),
    );
  });

  it('shows a reordering of two rows as moved lines', () => {
    const out = unifiedDiff('x\nodudu-admin\nmy-app\ny', 'x\nmy-app\nodudu-admin\ny', names);
    expect(out).toContain('-odudu-admin');
    expect(out).toContain('+odudu-admin');
  });
});
