import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import { renderRequiredActionPage } from '#/view/required-action-html';
import { ARABIC, FRENCH } from '#test/fr-catalogue';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('#test/fr-catalogue');
  return withFrench(await importOriginal(), {
    'requiredAction.title': 'Encore une étape',
    'requiredAction.pending':
      'Ce compte a une action en attente ({action}) qui ne peut pas encore être terminée ici.',
  });
});

function expectFragment(page: { html: string; body: string }): void {
  expect(page.body).not.toContain('<!doctype');
  expect(page.body).not.toContain('<html');
  expect(page.html).toContain('<!doctype html>');
  expect(page.html).toContain(page.body);
}

describe('renderRequiredActionPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderRequiredActionPage('configure-passkey', DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('One more step');
    expect(page.body).toContain('pending action');
    expectFragment(page);
  });

  it('keeps the English markup exactly, the action isolated', () => {
    expect(renderRequiredActionPage('configure-passkey', DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>One more step</h1>
<p>This account has a pending action (<bdi>configure-passkey</bdi>) that cannot be completed here yet.</p>
<p>Ask an administrator to finish setting up this account.</p>`);
  });

  it('names the action asked for', () => {
    const page = renderRequiredActionPage('generate-recovery-codes', DEFAULT_PAGE_LOCALE);
    expect(page.body).toContain('generate-recovery-codes');
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRequiredActionPage('update-password', FRENCH);
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.title).toBe('Encore une étape');
    expect(page.body).toContain('action en attente (<bdi>update-password</bdi>)');
    expect(page.body).toContain(`<p>${en['requiredAction.askAdmin']}</p>`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRequiredActionPage('configure-totp', ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });

  it('keeps an action name that holds markup inside its isolate, in both languages', () => {
    const hostile = '</bdi><img src=x onerror=1>' as never;
    for (const locale of [DEFAULT_PAGE_LOCALE, FRENCH]) {
      const page = renderRequiredActionPage(hostile, locale);
      expect(page.html).toContain('<bdi>&lt;/bdi&gt;&lt;img src=x onerror=1&gt;</bdi>');
      expect(page.html).not.toContain('<img');
    }
  });
});
