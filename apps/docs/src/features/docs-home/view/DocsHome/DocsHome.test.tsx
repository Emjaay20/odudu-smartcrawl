import { describe, expect, it } from 'vitest';
import { DocsHome } from '@site/src/features/docs-home/view/DocsHome/DocsHome';
import { markupOf } from '@site/tests/support/markup';

describe('DocsHome', () => {
  it('is the documentation home of an installation, with no landing', () => {
    const $ = markupOf(<DocsHome />);
    expect($('main[data-page="docs-home"]')).toHaveLength(1);
    expect($('h1').text()).toBe('Documentation');
    expect($('[data-page="landing"]')).toHaveLength(0);
  });
});
