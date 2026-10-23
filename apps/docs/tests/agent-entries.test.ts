import { describe, expect, it } from 'vitest';
import { parseEntries } from '#docs/plugins/agent-entries.ts';

describe('reading the pages listed in llms.txt', () => {
  it('reads a title and an address from each list line and ignores the rest', () => {
    const text = [
      '# Odudu',
      '',
      '- [Concepts](https://s.test/odudu/concepts.md): Tenants.',
      '- [Quick start](/docs/quick-start.md)',
      'Not a list line [x](/y.md)',
    ].join('\n');
    expect(parseEntries(text)).toEqual([
      { title: 'Concepts', url: 'https://s.test/odudu/concepts.md' },
      { title: 'Quick start', url: '/docs/quick-start.md' },
    ]);
  });

  it('keeps a closing bracket inside a title', () => {
    expect(parseEntries('- [Array [T] type](/docs/a.md): d')).toEqual([
      { title: 'Array [T] type', url: '/docs/a.md' },
    ]);
  });
});
