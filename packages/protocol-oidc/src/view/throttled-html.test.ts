import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it, vi } from 'vitest';
import { renderThrottledPage } from '#/view/throttled-html';
import { ARABIC, FRENCH } from '#test/fr-catalogue';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('#test/fr-catalogue');
  return withFrench(await importOriginal(), {
    'throttled.title': 'Trop de tentatives',
    'throttled.retryAfter': 'Réessayez dans {seconds, plural, one {# seconde} other {# secondes}}.',
  });
});

describe('renderThrottledPage', () => {
  it('says when to try again, in whole seconds', () => {
    const page = renderThrottledPage(37, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Too many attempts');
    expect(page.body).toContain('Try again in 37 seconds.');
  });

  it('keeps the English markup exactly', () => {
    expect(renderThrottledPage(37, DEFAULT_PAGE_LOCALE).body).toBe(
      `<h1>Too many attempts</h1>
<p>Try again in 37 seconds.</p>
<p>Go back to the previous page when the time is up.</p>`,
    );
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

  it('declares its language and direction', () => {
    expect(renderThrottledPage(5, DEFAULT_PAGE_LOCALE).html).toContain(
      '<html lang="en" dir="ltr">',
    );
    expect(renderThrottledPage(5, ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });

  it('reads French through the same renderer, with the plural rule of that language', () => {
    const one = renderThrottledPage(1, FRENCH);
    expect(one.html).toContain('<html lang="fr" dir="ltr">');
    expect(one.title).toBe('Trop de tentatives');
    expect(one.body).toContain('<h1>Trop de tentatives</h1>');
    expect(one.body).toContain('Réessayez dans 1 seconde.');
    expect(renderThrottledPage(40, FRENCH).body).toContain('Réessayez dans 40 secondes.');
  });

  it('shows English for a key the French catalogue lacks', () => {
    expect(renderThrottledPage(5, FRENCH).body).toContain(
      '<p>Go back to the previous page when the time is up.</p>',
    );
  });
});
