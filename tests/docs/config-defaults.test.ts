import { describe, expect, it } from 'vitest';
import { configReference } from '../../packages/kernel/src/docs.js';
import { loadDocument } from './markdown.js';

// The reference page for configuration is generated from the loader. The
// documents below state a default in prose, as "`ODUDU_X` (default `n`)", and
// are held to the same value.
const DOCUMENTS = ['README.md', 'docs/request-paths.md', 'docs/admin-paths.md'] as const;

const STATED_DEFAULT = /`(ODUDU_[A-Z_]+|NODE_ENV)`[^`\n]{0,3}\(default `([^`\n]+)`\)/gu;

const defaults = new Map<string, string | undefined>(
  configReference().map((row) => [row.name, row.default]),
);

describe('defaults stated in prose are the loader’s', () => {
  it('finds the statements it checks', () => {
    const found = DOCUMENTS.flatMap((path) =>
      [...loadDocument(path).lines.join('\n').matchAll(STATED_DEFAULT)].map((match) => match[1]),
    );
    expect(found.length).toBeGreaterThanOrEqual(6);
  });

  it.each(DOCUMENTS)('%s names each default the loader produces', (path) => {
    const wrong: string[] = [];
    for (const match of loadDocument(path).lines.join('\n').matchAll(STATED_DEFAULT)) {
      const [, name = '', stated = ''] = match;
      if (!defaults.has(name)) {
        wrong.push(`${name} is not a variable the loader reads`);
      } else if (defaults.get(name) !== stated) {
        wrong.push(
          `${name}: says ${stated}, the loader's default is ${String(defaults.get(name))}`,
        );
      }
    }
    expect(wrong).toEqual([]);
  });
});
