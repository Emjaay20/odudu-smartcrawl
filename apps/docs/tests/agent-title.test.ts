import { describe, expect, it } from 'vitest';
import { dropRepeatedTitle } from '#docs/plugins/agent-title.ts';

describe('dropRepeatedTitle', () => {
  const copy = '# GET /audit\n\n> Reads the audit trail.\n\n# `GET /audit`\n\nBody.\n';

  it('drops a heading that repeats the title with its code marks', () => {
    expect(dropRepeatedTitle(copy, 'GET /audit', 1)).toBe(
      '# GET /audit\n\n> Reads the audit trail.\n\nBody.\n',
    );
  });

  it('reads a section of the combined file one level down', () => {
    const section = '## GET /audit\n\n> Reads the audit trail.\n\n## `GET /audit`\n\nBody.';
    expect(dropRepeatedTitle(section, 'GET /audit', 2)).toBe(
      '## GET /audit\n\n> Reads the audit trail.\n\nBody.',
    );
  });

  it('leaves a heading that says something else', () => {
    const other = '# GET /audit\n\n> Reads.\n\n# `GET /audit` in depth\n\nBody.\n';
    expect(dropRepeatedTitle(other, 'GET /audit', 1)).toBe(other);
  });

  it('leaves a page whose heading is not the first thing after its description', () => {
    const later = '# GET /audit\n\n> Reads.\n\nIntro.\n\n# `GET /audit`\n';
    expect(dropRepeatedTitle(later, 'GET /audit', 1)).toBe(later);
  });

  it('leaves a page with no repeat alone', () => {
    const plain = '# Guides\n\n> Reads.\n\nBody.\n';
    expect(dropRepeatedTitle(plain, 'Guides', 1)).toBe(plain);
  });
});
