import { describe, expect, it } from 'vitest';
import { dropImports } from '#docs/plugins/agent-mdx.ts';

describe('the Markdown copy of an MDX page', () => {
  it('drops the import lines and the blank lines they leave', () => {
    const text = "# T\n\nimport Tabs from '@theme/Tabs';\nimport X from '@site/x';\n\n\nBody.\n";
    expect(dropImports(text)).toBe('# T\n\nBody.\n');
  });

  it('keeps an import line that is an example inside a code fence', () => {
    const text = "```js\nimport a from 'a';\n```\n";
    expect(dropImports(text)).toBe(text);
  });
});
