import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it, vi } from 'vitest';
import { lostArt } from '#/view/lost-art';
import { renderServerErrorPage } from '#/view/server-error-html';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'serverError.title': 'Un problème est survenu',
    'serverError.requestId': 'Identifiant de requête : {id}',
  });
});

describe('renderServerErrorPage', () => {
  it('keeps the English markup exactly', () => {
    expect(renderServerErrorPage('01JABC', DEFAULT_PAGE_LOCALE).body).toBe(
      `${lostArt(true)}
<h1>Something went wrong</h1>
<p>The server could not complete this request. Try again in a moment.</p>
<p><small>Request ID: <bdi>01JABC</bdi></small></p>`,
    );
  });

  it('leaves the request id out when there is none to show', () => {
    const body = renderServerErrorPage(null, DEFAULT_PAGE_LOCALE).body;
    expect(body).not.toContain('Request ID');
    expect(body).not.toContain('<small>');
  });

  it('escapes the id', () => {
    const body = renderServerErrorPage('<img src=x onerror=1>', DEFAULT_PAGE_LOCALE).body;
    expect(body).not.toContain('<img');
    expect(body).toContain('&lt;img');
  });

  it('shows the drawing still: calm, with nothing to animate', () => {
    const body = renderServerErrorPage('x', DEFAULT_PAGE_LOCALE).body;
    expect(body).toContain('<svg class="lost lost-calm"');
  });

  it('is markup only, under the shell', () => {
    const page = renderServerErrorPage('x', DEFAULT_PAGE_LOCALE);
    expect(page.script).toBeNull();
    expect(page.body).not.toMatch(/<(script|form|a)\b/u);
    expect(page.html).toContain('class="mark"');
    expect(page.title).toBe('Something went wrong');
  });

  it('declares its language and direction, and reads French', () => {
    expect(renderServerErrorPage('x', ARABIC).html).toContain('<html lang="ar" dir="rtl">');
    const french = renderServerErrorPage('x', FRENCH);
    expect(french.title).toBe('Un problème est survenu');
    expect(french.body).toContain('Identifiant de requête : <bdi>x</bdi>');
  });
});
