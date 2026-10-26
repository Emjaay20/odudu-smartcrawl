import { describe, expect, it } from 'vitest';
import { PAGES_BASE, PAGES_DOCS_BASE } from '@site/site.config';
import { AGENT_ITEMS } from '@site/src/features/landing/service/content';
import { Agents } from '@site/src/features/landing/view/Agents/Agents';
import { markupOf } from '@site/tests/support/markup';

describe('Agents', () => {
  it('offers the Markdown copies as shipped, linking llms.txt', () => {
    const $ = markupOf(<Agents />);
    const shipped = $('[data-shipped]');
    expect(shipped).toHaveLength(1);
    expect(shipped.find(`a[href="${PAGES_BASE}llms.txt"]`)).toHaveLength(1);
    expect(shipped.find('[data-chip]').text()).toBe('Works today');
  });

  it('labels each planned item Planned and links it to the roadmap', () => {
    const $ = markupOf(<Agents />);
    const planned = $('[data-planned]');
    expect(planned).toHaveLength(AGENT_ITEMS.length);
    planned.each((_, element) => {
      const item = $(element);
      expect(item.find('[data-chip]').text()).toBe('Planned');
      expect(item.find(`a[href="${PAGES_DOCS_BASE}roadmap/#next"]`)).toHaveLength(1);
      expect(item.text()).toContain(
        AGENT_ITEMS.find((i) => i.id === item.attr('data-planned'))?.claim,
      );
    });
  });

  it('names no phase, no date and no "coming soon"', () => {
    const $ = markupOf(<Agents />);
    expect($.text()).not.toMatch(/\bP\d+[a-z]?\b|coming soon|\b20\d\d\b|\bsoon\b/iu);
  });
});
