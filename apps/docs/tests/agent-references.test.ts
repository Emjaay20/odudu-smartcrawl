import { describe, expect, it } from 'vitest';
import { appendReferences } from '#docs/plugins/agent-references.ts';

const REFERENCE = {
  title: 'Admin API',
  description: 'The OpenAPI document.',
  file: 'openapi/admin.json',
};

describe('listing machine-readable references in llms.txt', () => {
  it('appends a section naming each reference by its address', () => {
    const text = appendReferences('# T\n\n- [A](https://s.test/a.md): d\n', [REFERENCE], '/docs/');
    expect(text).toBe(
      '# T\n\n- [A](https://s.test/a.md): d\n\n' +
        '## Machine-readable references\n\n' +
        '- [Admin API](/docs/openapi/admin.json): The OpenAPI document.\n',
    );
  });

  it('leaves the text as it is when there are none', () => {
    expect(appendReferences('# T\n', [], '/docs/')).toBe('# T\n');
  });
});
