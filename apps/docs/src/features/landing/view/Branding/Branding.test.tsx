import { describe, expect, it } from 'vitest';
import { PAGES_BASE, PAGES_DOCS_BASE } from '@site/site.config';
import { BRANDING } from '@site/src/features/landing/service/content';
import { Branding } from '@site/src/features/landing/view/Branding/Branding';
import { markupOf } from '@site/tests/support/markup';

describe('Branding', () => {
  it('is a band of its own, with its text beside one framed picture', () => {
    const $ = markupOf(<Branding />);
    const band = $('section[data-section="branding"]');
    expect(band).toHaveLength(1);
    expect(band.find('h2').text()).toBe(BRANDING.title);
    expect(band.find('[data-planned="branding"]')).toHaveLength(1);
    expect(band.find('[data-aside] [data-frame="look"]')).toHaveLength(1);
    expect(band.find('[data-aside] fieldset')).toHaveLength(0);
    expect(band.find('fieldset')).toHaveLength(1);
  });

  it('is labelled Planned and links the roadmap, with no phase name', () => {
    const $ = markupOf(<Branding />);
    const item = $('[data-planned="branding"]');
    expect(item).toHaveLength(1);
    expect(item.find('[data-chip]').text()).toBe('Planned');
    expect(item.text()).toContain(BRANDING.claim);
    expect(item.find(`a[href="${PAGES_DOCS_BASE}roadmap/#next"]`)).toHaveLength(1);
    expect(item.text()).not.toMatch(/\bP\d+[a-z]?\b|coming soon/iu);
  });

  it('swaps two looks of the same page with a labelled control that needs no script', () => {
    const $ = markupOf(<Branding />);
    const group = $('fieldset');
    expect(group).toHaveLength(1);
    expect(group.find('legend').text()).toMatch(/illustration of a planned feature/iu);
    const choices = group.find('input[type="radio"]');
    expect(choices).toHaveLength(2);
    expect(choices.filter('[checked]')).toHaveLength(1);
    expect($('script')).toHaveLength(0);
    const sources = $('img')
      .map((_, image) => $(image).attr('src'))
      .get();
    expect(sources).toEqual([
      `${PAGES_BASE}server-pages/sign-in-light.webp`,
      `${PAGES_BASE}server-pages/sign-in-dark.webp`,
      `${PAGES_BASE}server-pages/sign-in-branded-light.webp`,
      `${PAGES_BASE}server-pages/sign-in-branded-dark.webp`,
    ]);
    $('img').each((_, element) => {
      expect($(element).attr('loading')).toBe('lazy');
      expect($(element).attr('width')).toBe('460');
    });
  });

  it('says the illustration once: in the legend, with a short caption', () => {
    const $ = markupOf(<Branding />);
    expect($('legend').text()).toMatch(/illustration of a planned feature/iu);
    expect($('figcaption').text()).toBe('Only the colours change.');
  });

  it('says what ships today in a line of its own', () => {
    const $ = markupOf(<Branding />);
    expect($('[data-today]').text()).toBe(BRANDING.today);
  });
});
