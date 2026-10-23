import { describe, expect, it } from 'vitest';
import { introOf } from '@site/src/features/docs-home/service/intro';

describe('introOf', () => {
  it('says whose documentation it is only inside an installation', () => {
    expect(introOf('installation')).toContain('you are running');
    expect(introOf('public')).not.toContain('you are running');
  });
});
