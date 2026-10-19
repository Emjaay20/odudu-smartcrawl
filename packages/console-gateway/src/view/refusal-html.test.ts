import { DEFAULT_PAGE_LOCALE, INSTRUMENT_STYLESHEET } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import { renderSignInRefused } from '#/view/refusal-html';
import { sendPage } from '#/view/send-page';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'refusal.title': 'La connexion a échoué',
    'refusal.reason': "La connexion n'a pas pu aboutir.",
  });
});

describe('renderSignInRefused', () => {
  it('says only that sign-in could not be completed, and carries no script', () => {
    const page = renderSignInRefused(DEFAULT_PAGE_LOCALE);
    expect(page.html).toContain('sign-in could not be completed');
    expect(page.script).toBeNull();
    expect(page.frames).toEqual([]);
  });

  it('offers one way out, back to the console, which begins a fresh sign-in', () => {
    const page = renderSignInRefused(DEFAULT_PAGE_LOCALE);
    expect(page.html).toContain('<a href="/console/">Sign in again</a>');
    expect(page.html.match(/<a /gu)).toHaveLength(1);
  });

  it('keeps the English markup exactly', () => {
    const page = renderSignInRefused(DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Sign-in failed');
    expect(page.body).toBe(`<h1>Sign-in failed</h1>
<p>The sign-in could not be completed.</p>
<p><a href="/console/">Sign in again</a></p>`);
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderSignInRefused(FRENCH);
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.title).toBe('La connexion a échoué');
    expect(page.body).toContain('<p>La connexion n&#39;a pas pu aboutir.</p>');
    expect(page.body).toContain(`<a href="/console/">${en['refusal.again']}</a>`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderSignInRefused(ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });
});

describe('a refusal sent through sendPage', () => {
  async function respond(locale: typeof DEFAULT_PAGE_LOCALE) {
    const app = Fastify();
    app.get('/', (_request, reply) => sendPage(reply, 400, renderSignInRefused(locale)));
    const response = await app.inject({ method: 'GET', url: '/' });
    await app.close();
    return response;
  }

  it('arrives with the Instrument stylesheet link and Content-Language: en', async () => {
    const response = await respond(DEFAULT_PAGE_LOCALE);
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain(`<link rel="stylesheet" href="${INSTRUMENT_STYLESHEET}">`);
    expect(response.headers['content-language']).toBe('en');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('sends the language the page is written in', async () => {
    expect((await respond(FRENCH)).headers['content-language']).toBe('fr');
  });
});
