import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import {
  renderRequiredActionsForm,
  renderRequiredActionsSucceededPage,
} from '#/view/required-actions-html';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'requiredActions.title': 'Mettez à jour votre compte',
    'requiredActions.intro': 'Votre administrateur vous demande de :',
    'requiredActions.action.configureTotp': 'Configurer une application d’authentification',
    'requiredActions.succeeded.close': 'Vous pouvez fermer cette page.',
  });
});

const EN = DEFAULT_PAGE_LOCALE;

describe('renderRequiredActionsForm', () => {
  it('keeps the English markup exactly, with and without a password field', () => {
    expect(
      renderRequiredActionsForm('acme', 'k"ey', ['update-password', 'configure-totp'], true, EN)
        .body,
    ).toBe(`<h1>Update your account</h1>
<p>Your administrator asks you to:</p>
<ul>
<li>Choose a new password</li>
<li>Set up an authenticator app</li>
</ul>
<form method="post" action="/tenants/acme/login-actions/action-token">
  <input type="hidden" name="key" value="k&quot;ey">
  <label>New password <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">Continue</button>
</form>`);
    const without = renderRequiredActionsForm('acme', 'key', ['configure-passkey'], false, EN);
    expect(without.body).not.toContain('password');
    expect(without.body).toContain('<li>Register a passkey</li>');
    expect(without.script).toBeNull();
    expect(without.title).toBe('Update your account');
  });

  it('words every action the link can carry', () => {
    const { body } = renderRequiredActionsForm(
      'acme',
      'k',
      ['update-password', 'configure-totp', 'configure-passkey', 'generate-recovery-codes'],
      false,
      EN,
    );
    for (const text of [
      'Choose a new password',
      'Set up an authenticator app',
      'Register a passkey',
      'Save a set of recovery codes',
    ]) {
      expect(body).toContain(`<li>${text}</li>`);
    }
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRequiredActionsForm(
      'acme',
      'k',
      ['configure-totp', 'update-password'],
      true,
      FRENCH,
    );
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.title).toBe('Mettez à jour votre compte');
    expect(page.body).toContain('<p>Votre administrateur vous demande de :</p>');
    expect(page.body).toContain('<li>Configurer une application d’authentification</li>');
    expect(page.body).toContain(`<li>${en['requiredActions.action.updatePassword']}</li>`);
    expect(page.body).toContain(`<label>${en['requiredActions.newPassword']} <input`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRequiredActionsForm('acme', 'k', [], false, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });

  it('escapes the tenant and key, and isolates an action code it has no wording for', () => {
    const hostile = '<img src=x onerror=1>' as never;
    for (const locale of [EN, FRENCH]) {
      const { html, body } = renderRequiredActionsForm('<t>', '"><i>', [hostile], true, locale);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<t>');
      expect(html).not.toContain('"><i>');
      expect(body).toContain('<li><bdi>&lt;img src=x onerror=1&gt;</bdi></li>');
    }
  });

  it('does not take an action named like an object member for a catalogue entry', () => {
    expect(
      renderRequiredActionsForm('acme', 'k', ['constructor' as never], false, EN).body,
    ).toContain('<li><bdi>constructor</bdi></li>');
  });
});

describe('renderRequiredActionsSucceededPage', () => {
  it('keeps the English markup exactly, with nothing remaining and with something remaining', () => {
    const done = renderRequiredActionsSucceededPage([], EN);
    expect(done.title).toBe('Account updated');
    expect(done.body).toBe(`<h1>Your account is updated</h1>
<p>You can close this page and sign in to the application.</p>`);
    expect(renderRequiredActionsSucceededPage(['configure-passkey'], EN).body)
      .toBe(`<h1>Your account is updated</h1>
<p>Sign in to the application to finish:</p>
<ul>
<li>Register a passkey</li>
</ul>`);
  });

  it('reads French where the fixture has it and English for the rest', () => {
    expect(renderRequiredActionsSucceededPage([], FRENCH).body).toContain(
      '<p>Vous pouvez fermer cette page.</p>',
    );
    expect(renderRequiredActionsSucceededPage(['configure-totp'], FRENCH).body).toContain(
      `<p>${en['requiredActions.succeeded.finish']}</p>`,
    );
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRequiredActionsSucceededPage([], ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });
});
