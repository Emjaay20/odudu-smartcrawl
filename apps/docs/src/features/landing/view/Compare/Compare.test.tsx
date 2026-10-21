import { describe, expect, it } from 'vitest';
import { Compare } from '@site/src/features/landing/view/Compare/Compare';
import { markupOf } from '@site/tests/support/markup';
import { PAGES_BASE } from '@site/site.config';

describe('Compare', () => {
  it('says plainly that it is not ready for production', () => {
    const $ = markupOf(<Compare />);
    expect($('strong').text()).toBe('Odudu is not ready for production.');
  });

  it('links the comparison, the Keycloak guide and the roadmap', () => {
    const $ = markupOf(<Compare />);
    expect(
      $('a')
        .map((_, link) => $(link).attr('href'))
        .get(),
    ).toEqual([
      `${PAGES_BASE}introduction/compare/`,
      `${PAGES_BASE}guides/keycloak/`,
      `${PAGES_BASE}roadmap/`,
    ]);
  });
});
