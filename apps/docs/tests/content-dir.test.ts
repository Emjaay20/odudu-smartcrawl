import { describe, expect, it } from 'vitest';
import { contentDir } from '#docs/plugins/content-dir.ts';

describe('the documentation tree a build reads', () => {
  it('is content/en unless a test names a tree under the build cache', () => {
    expect(contentDir(undefined)).toBe('content/en');
    expect(contentDir('')).toBe('content/en');
    expect(contentDir('node_modules/.cache/odudu-docs-generated-1/content')).toBe(
      'node_modules/.cache/odudu-docs-generated-1/content',
    );
  });

  it.each(['/tmp/fixture', 'content/other', 'node_modules/.cache/../../etc', '../content'])(
    'refuses %s',
    (value) => {
      expect(() => contentDir(value)).toThrow(/DOCS_CONTENT/u);
    },
  );
});
