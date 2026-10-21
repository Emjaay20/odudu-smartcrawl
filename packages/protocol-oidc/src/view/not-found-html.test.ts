import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it, vi } from 'vitest';
import { lostArt } from '#/view/lost-art';
import { renderNotFoundPage } from '#/view/not-found-html';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'notFound.title': 'Page introuvable',
    'notFound.body': "Il n'y a rien à cette adresse.",
  });
});

const LINKS = { console: 'https://console.example.test/console/', docs: '/docs/' };

describe('renderNotFoundPage', () => {
  it('keeps the English markup exactly', () => {
    expect(renderNotFoundPage(LINKS, DEFAULT_PAGE_LOCALE).body).toBe(
      `${lostArt(false)}
<h1>Page not found</h1>
<p>There is nothing at this address.</p>
<ul>
<li><a href="https://console.example.test/console/">Open the console</a></li>
<li><a href="/docs/">Read the documentation</a></li>
</ul>`,
    );
  });

  it('is a whole document under the shell, with the mark and a title', () => {
    const page = renderNotFoundPage(LINKS, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Page not found');
    expect(page.html).toContain('<!doctype html>');
    expect(page.html).toContain('class="mark"');
    expect(page.html).toContain('<title>Page not found</title>');
    expect(page.script).toBeNull();
  });

  it('carries the drawing that plays once, decoratively', () => {
    const page = renderNotFoundPage(LINKS, DEFAULT_PAGE_LOCALE);
    expect(page.body).toContain('<svg class="lost"');
    expect(page.body).not.toContain('lost-calm');
    expect(page.body).toContain('aria-hidden="true"');
    expect(page.html).not.toContain('style=');
  });

  it('offers only the destinations this deployment has', () => {
    const none = renderNotFoundPage({}, DEFAULT_PAGE_LOCALE).body;
    expect(none).not.toMatch(/<(ul|a)\b/u);
    expect(renderNotFoundPage({ docs: '/docs/' }, DEFAULT_PAGE_LOCALE).body).not.toContain(
      'console',
    );
  });

  it('escapes an address it is given', () => {
    const body = renderNotFoundPage({ docs: '"><script>x</script>' }, DEFAULT_PAGE_LOCALE).body;
    expect(body).not.toContain('<script>');
  });

  it('declares its language and direction, and reads French', () => {
    expect(renderNotFoundPage(LINKS, ARABIC).html).toContain('<html lang="ar" dir="rtl">');
    const french = renderNotFoundPage(LINKS, FRENCH);
    expect(french.html).toContain('<html lang="fr" dir="ltr">');
    expect(french.title).toBe('Page introuvable');
    expect(french.body).toContain('Il n&#39;y a rien à cette adresse.');
    expect(french.body).toContain('Open the console');
  });
});
