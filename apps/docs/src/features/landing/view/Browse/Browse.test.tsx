import { describe, expect, it } from 'vitest';
import { JOURNEYS, SECTIONS } from '@site/nav';
import { Browse } from '@site/src/features/landing/view/Browse/Browse';
import { markupOf } from '@site/tests/support/markup';
import { PAGES_BASE, PAGES_DOCS_BASE } from '@site/site.config';

describe('Browse', () => {
  it('links every section and every journey', () => {
    const $ = markupOf(<Browse />);
    const hrefs = $('a')
      .map((_, link) => $(link).attr('href'))
      .get();
    for (const section of SECTIONS) expect(hrefs).toContain(`${PAGES_DOCS_BASE}${section.route}`);
    for (const journey of JOURNEYS) expect(hrefs).toContain(`${PAGES_DOCS_BASE}${journey.route}`);
  });

  it('links the documentation home, which nothing else on the site links', () => {
    const $ = markupOf(<Browse />);
    expect($('a[data-docs-home]').attr('href')).toBe(PAGES_DOCS_BASE);
  });

  it('tells assistants about llms.txt and says the MCP server is planned and not built', () => {
    const $ = markupOf(<Browse />);
    const agents = $('[data-section="agents"]');
    expect(agents.find(`a[href="${PAGES_BASE}llms.txt"]`)).toHaveLength(1);
    expect(agents.text()).toMatch(/planned/u);
    expect(agents.text()).toMatch(/not built yet/u);
  });
});
