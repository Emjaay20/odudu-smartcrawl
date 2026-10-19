import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { renderThrottledPage } from '#/view/throttled-html';

describe('renderThrottledPage', () => {
  it('says when to try again, in whole seconds', () => {
    const page = renderThrottledPage(37, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Too many attempts');
    expect(page.body).toContain('Try again in 37 seconds.');
  });

  it('says one second in the singular', () => {
    expect(renderThrottledPage(1, DEFAULT_PAGE_LOCALE).body).toContain('Try again in 1 second.');
  });

  it('rounds a fraction up, never to a time that is still too soon', () => {
    expect(renderThrottledPage(2.2, DEFAULT_PAGE_LOCALE).body).toContain('Try again in 3 seconds.');
    expect(renderThrottledPage(0, DEFAULT_PAGE_LOCALE).body).toContain('Try again in 1 second.');
  });

  it('is markup only: no script, no form, no link, no cause', () => {
    const page = renderThrottledPage(30, DEFAULT_PAGE_LOCALE);
    expect(page.script).toBeNull();
    expect(page.body).not.toMatch(/<(script|form|a)\b/u);
    expect(page.body).not.toMatch(/username|account|password/iu);
    expect(page.html).toContain('<!doctype html>');
  });
});
