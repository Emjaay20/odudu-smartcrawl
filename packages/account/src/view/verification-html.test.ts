import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import {
  renderVerificationFailedPage,
  renderVerificationSucceededPage,
  sendVerificationHtml,
} from '#/view/verification-html';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'verification.succeeded.title': 'Adresse e-mail vérifiée',
    'verification.succeeded.heading': 'Votre adresse e-mail est vérifiée',
    'verification.failed.heading': "Ce lien n'est pas utilisable",
  });
});

function expectFragment(page: { html: string; body: string }): void {
  expect(page.body).not.toContain('<!doctype');
  expect(page.body).not.toContain('<html');
  expect(page.html).toContain('<!doctype html>');
  expect(page.html).toContain(page.body);
}

describe('renderVerificationSucceededPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderVerificationSucceededPage(DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Email verified');
    expect(page.body).toContain('is verified');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderVerificationSucceededPage(DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>Your email address is verified</h1>
<p>You can close this page and sign in.</p>`);
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderVerificationSucceededPage(FRENCH);
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.title).toBe('Adresse e-mail vérifiée');
    expect(page.body).toContain('<h1>Votre adresse e-mail est vérifiée</h1>');
    expect(page.body).toContain(`<p>${en['verification.succeeded.next']}</p>`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderVerificationSucceededPage(ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });
});

describe('renderVerificationFailedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderVerificationFailedPage(DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe("Can't verify this link");
    expect(page.body).toContain('This link can&#39;t be used');
    expectFragment(page);
  });

  it('keeps the English markup exactly, apostrophe escaped as the catalogue escapes it', () => {
    expect(renderVerificationFailedPage(DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>This link can&#39;t be used</h1>
<p>It may have already been used, expired, or no longer matches your email address. Request a new verification email and try again.</p>`);
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderVerificationFailedPage(FRENCH);
    expect(page.title).toBe(en['verification.failed.title']);
    expect(page.body).toContain('<h1>Ce lien n&#39;est pas utilisable</h1>');
    expect(page.body).toContain(en['verification.failed.reason']);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderVerificationFailedPage(ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });
});

describe('sendVerificationHtml', () => {
  async function respond(locale: typeof DEFAULT_PAGE_LOCALE) {
    const app = Fastify();
    app.get('/', (_request, reply) =>
      sendVerificationHtml(reply, 400, renderVerificationFailedPage(locale)),
    );
    const response = await app.inject({ method: 'GET', url: '/' });
    await app.close();
    return response;
  }

  it('sends content-language from the verification wrapper', async () => {
    expect((await respond(FRENCH)).headers['content-language']).toBe('fr');
    expect((await respond(DEFAULT_PAGE_LOCALE)).headers['content-language']).toBe('en');
  });

  it('sends the status, the html type and the page', async () => {
    const response = await respond(DEFAULT_PAGE_LOCALE);
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.body).toContain('<html lang="en" dir="ltr">');
  });
});
