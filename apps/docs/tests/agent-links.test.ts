import { describe, expect, it } from 'vitest';
import { rewriteLinks, type LinkTarget } from '#docs/plugins/agent-links.ts';

const PAGES: LinkTarget = { base: '/odudu/', origin: 'https://site.test' };
const IMAGE: LinkTarget = { base: '/docs/', origin: null };
const SOURCE = 'reference/generated/example.md';

// Each row is written out by hand for both bases: the input, then what a copy must say.
const FORMS: { form: string; input: string; pages: string; image: string }[] = [
  {
    form: 'a site-absolute link',
    input: 'See [a](/quick-start/).',
    pages: 'See [a](https://site.test/odudu/quick-start/).',
    image: 'See [a](/docs/quick-start/).',
  },
  {
    form: 'a relative file link up and across',
    input: '[i](../../introduction/index.md)',
    pages: '[i](https://site.test/odudu/introduction/)',
    image: '[i](/docs/introduction/)',
  },
  {
    form: 'a sibling file link with a fragment',
    input: '[o](./other.md#x)',
    pages: '[o](https://site.test/odudu/reference/generated/other/#x)',
    image: '[o](/docs/reference/generated/other/#x)',
  },
  {
    form: 'a sibling file link with a query and a fragment',
    input: '[o](other.md?v=2#x)',
    pages: '[o](https://site.test/odudu/reference/generated/other/?v=2#x)',
    image: '[o](/docs/reference/generated/other/?v=2#x)',
  },
  {
    form: 'a site-absolute link with a query and a fragment',
    input: '[a](/guides/?q=1&r=2#top)',
    pages: '[a](https://site.test/odudu/guides/?q=1&r=2#top)',
    image: '[a](/docs/guides/?q=1&r=2#top)',
  },
  {
    form: 'a link whose text is inline code',
    input: 'See [`GET /x`](./other.md#x) and `code` then [`a`](/guides/) twice.',
    pages:
      'See [`GET /x`](https://site.test/odudu/reference/generated/other/#x) and `code` then [`a`](https://site.test/odudu/guides/) twice.',
    image:
      'See [`GET /x`](/docs/reference/generated/other/#x) and `code` then [`a`](/docs/guides/) twice.',
  },
  {
    form: 'a link whose text is wrapped onto the next line',
    input: 'See [the first part\nand the second](./other.md#x) there.',
    pages:
      'See [the first part\nand the second](https://site.test/odudu/reference/generated/other/#x) there.',
    image: 'See [the first part\nand the second](/docs/reference/generated/other/#x) there.',
  },
  {
    form: 'a destination that only looks like a link inside inline code',
    input: 'Write `[a](./other.md)` to link.',
    pages: 'Write `[a](./other.md)` to link.',
    image: 'Write `[a](./other.md)` to link.',
  },
  {
    form: 'a pathname:// link to a file in the static directory',
    input: '[j](pathname:///openapi/admin.json)',
    pages: '[j](https://site.test/odudu/openapi/admin.json)',
    image: '[j](/docs/openapi/admin.json)',
  },
  {
    form: 'an image with a title',
    input: '![x](/brand/favicon.svg "t")',
    pages: '![x](https://site.test/odudu/brand/favicon.svg "t")',
    image: '![x](/docs/brand/favicon.svg "t")',
  },
  {
    form: 'a url holding balanced parentheses',
    input: 'See [a](/guides/a_(b)/) now (really).',
    pages: 'See [a](https://site.test/odudu/guides/a_(b)/) now (really).',
    image: 'See [a](/docs/guides/a_(b)/) now (really).',
  },
  {
    form: 'a destination in angle brackets',
    input: '[a](<../a b.md>)',
    pages: '[a](<https://site.test/odudu/reference/a b/>)',
    image: '[a](</docs/reference/a b/>)',
  },
  {
    form: 'a reference definition with a title',
    input: '[ref]: ../../concepts/index.md "Concepts"',
    pages: '[ref]: https://site.test/odudu/concepts/ "Concepts"',
    image: '[ref]: /docs/concepts/ "Concepts"',
  },
  {
    form: 'a reference definition with an angle-bracket destination',
    input: '  [ref]: </security/>',
    pages: '  [ref]: <https://site.test/odudu/security/>',
    image: '  [ref]: </docs/security/>',
  },
  {
    form: 'a raw anchor and a raw image',
    input: '<a href="/quick-start/">q</a> <img src=\'/brand/favicon.svg\' alt="i">',
    pages:
      '<a href="https://site.test/odudu/quick-start/">q</a> ' +
      '<img src=\'https://site.test/odudu/brand/favicon.svg\' alt="i">',
    image: '<a href="/docs/quick-start/">q</a> <img src=\'/docs/brand/favicon.svg\' alt="i">',
  },
  {
    form: 'a raw anchor to a sibling file',
    input: '<a class="x" href="./other.md">o</a>',
    pages: '<a class="x" href="https://site.test/odudu/reference/generated/other/">o</a>',
    image: '<a class="x" href="/docs/reference/generated/other/">o</a>',
  },
];

const UNTOUCHED = [
  '[a](#here)',
  '[b](https://example.com/x_(y))',
  '[c](mailto:a@b.test)',
  '[d](//cdn.test/x)',
  'An autolink <https://example.com/a?b=c#d> and <mailto:a@b.test>.',
  '[ref]: https://example.com/ref',
  '<a href="https://example.com/x">x</a> <a href="#top">t</a>',
  '[a](./data.json)',
  '`[a](/x/)` and `<a href="/x/">`',
  ['```md', '[b](/x/)', '[ref]: /x/', '<a href="/x/">', '```'].join('\n'),
  ['~~~', '[c](/x/)', '~~~'].join('\n'),
  ['````', '```', '[d](/x/)', '````'].join('\n'),
];

describe('rewriting the links of a Markdown copy', () => {
  it.each(FORMS)('rewrites $form under the Pages base', ({ input, pages }) => {
    expect(rewriteLinks(input, SOURCE, PAGES)).toBe(pages);
  });

  it.each(FORMS)('rewrites $form under the image base', ({ input, image }) => {
    expect(rewriteLinks(input, SOURCE, IMAGE)).toBe(image);
  });

  it.each(UNTOUCHED)('leaves %j as written', (text) => {
    expect(rewriteLinks(text, SOURCE, PAGES)).toBe(text);
    expect(rewriteLinks(text, SOURCE, IMAGE)).toBe(text);
  });

  it('resumes after a fence closes', () => {
    const text = ['```', '[a](/x/)', '```', '[b](/y/)'].join('\n');
    expect(rewriteLinks(text, SOURCE, IMAGE)).toBe(
      ['```', '[a](/x/)', '```', '[b](/docs/y/)'].join('\n'),
    );
  });
});
