import { describe, expect, it } from 'vitest';
import { rewriteLinks, type LinkTarget } from '#docs/plugins/agent-links.ts';

const PAGES: LinkTarget = { base: '/odudu/', origin: 'https://site.test' };
const IMAGE: LinkTarget = { base: '/docs/', origin: null };
const SOURCE = 'reference/generated/example.md';

describe('rewriting the links of a Markdown copy', () => {
  it('prefixes a site-absolute link with the base and the origin', () => {
    expect(rewriteLinks('See [a](/quick-start/#run).', SOURCE, PAGES)).toBe(
      'See [a](https://site.test/odudu/quick-start/#run).',
    );
  });

  it('keeps the image origin-relative under its own base', () => {
    expect(rewriteLinks('See [a](/quick-start/).', SOURCE, IMAGE)).toBe(
      'See [a](/docs/quick-start/).',
    );
  });

  it('resolves a relative file link against the source file and names its route', () => {
    expect(rewriteLinks('[i](../../introduction/index.md) [o](./other.md#x)', SOURCE, PAGES)).toBe(
      '[i](https://site.test/odudu/introduction/) ' +
        '[o](https://site.test/odudu/reference/generated/other/#x)',
    );
  });

  it('leaves anchors, other hosts, mail links and protocol-relative links alone', () => {
    const text = '[a](#here) [b](https://example.com/x) [c](mailto:a@b.test) [d](//cdn.test/x)';
    expect(rewriteLinks(text, SOURCE, PAGES)).toBe(text);
  });

  it('rewrites an image whose target is site-absolute', () => {
    expect(rewriteLinks('![x](/brand/favicon.svg "t")', SOURCE, IMAGE)).toBe(
      '![x](/docs/brand/favicon.svg "t")',
    );
  });

  it('leaves code fences and inline code as written', () => {
    const text = ['`[a](/x/)`', '```md', '[b](/x/)', '```', '~~~', '[c](/x/)', '~~~'].join('\n');
    expect(rewriteLinks(text, SOURCE, PAGES)).toBe(text);
  });

  it('leaves a relative link to something other than a page unchanged', () => {
    expect(rewriteLinks('[a](./data.json)', SOURCE, PAGES)).toBe('[a](./data.json)');
  });
});
