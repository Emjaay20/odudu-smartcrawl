import { describe, expect, it } from 'vitest';
import { PAGES_BASE } from '@site/site.config';
import { Ways } from '@site/src/features/landing/view/Ways/Ways';
import { markupOf } from '@site/tests/support/markup';

describe('Ways', () => {
  it('offers four ways in and four examples, each with its guide', () => {
    const $ = markupOf(<Ways />);
    expect($('[data-section="readers"]')).toHaveLength(1);
    expect($('[data-section="examples"] li')).toHaveLength(4);
    expect($(`[data-section="examples"] a[href^="${PAGES_BASE}guides/"]`)).toHaveLength(4);
  });

  it('opens the examples folder in a new tab, safely, and says so', () => {
    const $ = markupOf(<Ways />);
    const link = $('a[target="_blank"]');
    expect(link.attr('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain('(opens in a new tab)');
  });
});
