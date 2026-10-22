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
      renderRequiredActionsForm(
        'acme',
        'k"ey',
        ['update-password', 'configure-totp'],
        true,
        undefined,
        EN,
      ).body,
    ).toBe(`<header class="intro">
<h1>Update your account</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
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
    const without = renderRequiredActionsForm(
      'acme',
      'key',
      ['configure-passkey'],
      false,
      undefined,
      EN,
    );
    expect(without.body).not.toContain('password');
    expect(without.body).toContain('<li>Register a passkey</li>');
    expect(without.script).toBeNull();
    expect(without.title).toBe('Update your account');
  });

  it('comes back in place with the reasons above the form and the field marked', () => {
    const { body } = renderRequiredActionsForm(
      'acme',
      'key',
      ['update-password'],
      true,
      [{ rule: 'require-digit', message: 'dev' }],
      EN,
    );
    expect(body).toContain(`<li>Choose a new password</li>
</ul>
<div class="alert" role="alert" id="form-error">
<ul>
<li id="form-error-0">Password must contain a digit.</li>
</ul>
</div>
<form`);
    expect(body).toContain(
      'autocomplete="new-password" aria-invalid="true" aria-describedby="form-error-0" autofocus>',
    );
  });

  it('marks nothing on a link that asks for no password', () => {
    const { body } = renderRequiredActionsForm(
      'acme',
      'key',
      ['configure-totp'],
      false,
      'required',
      EN,
    );
    expect(body).not.toContain('aria-invalid');
  });

  it('words every action the link can carry', () => {
    const { body } = renderRequiredActionsForm(
      'acme',
      'k',
      ['update-password', 'configure-totp', 'configure-passkey', 'generate-recovery-codes'],
      false,
      undefined,
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
      undefined,
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
    expect(renderRequiredActionsForm('acme', 'k', [], false, undefined, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });

  it('escapes the tenant and key, and isolates an action code it has no wording for', () => {
    const hostile = '<img src=x onerror=1>' as never;
    for (const locale of [EN, FRENCH]) {
      const { html, body } = renderRequiredActionsForm(
        '<t>',
        '"><i>',
        [hostile],
        true,
        undefined,
        locale,
      );
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<t>');
      expect(html).not.toContain('"><i>');
      expect(body).toContain('<li><bdi>&lt;img src=x onerror=1&gt;</bdi></li>');
    }
  });

  it('does not take an action named like an object member for a catalogue entry', () => {
    expect(
      renderRequiredActionsForm('acme', 'k', ['constructor' as never], false, undefined, EN).body,
    ).toContain('<li><bdi>constructor</bdi></li>');
  });
});

describe('renderRequiredActionsSucceededPage', () => {
  it('keeps the English markup exactly, with nothing remaining and with something remaining', () => {
    const done = renderRequiredActionsSucceededPage([], null, EN);
    expect(done.title).toBe('Account updated');
    expect(done.body).toBe(`<h1>Your account is updated</h1>
<p>Return to the application you were signing in to and sign in again.</p>`);
    expect(renderRequiredActionsSucceededPage(['configure-passkey'], null, EN).body)
      .toBe(`<h1>Your account is updated</h1>
<p>Sign in to the application to finish:</p>
<ul>
<li>Register a passkey</li>
</ul>`);
  });

  it('reads French where the fixture has it and English for the rest', () => {
    expect(renderRequiredActionsSucceededPage([], null, FRENCH).body).toContain(
      '<p>Vous pouvez fermer cette page.</p>',
    );
    expect(renderRequiredActionsSucceededPage(['configure-totp'], null, FRENCH).body).toContain(
      `<p>${en['requiredActions.succeeded.finish']}</p>`,
    );
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRequiredActionsSucceededPage([], null, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });
});

describe('the actions pages with the way back a mailed link carried', () => {
  const way = '/tenants/acme/protocol/openid-connect/auth?client_id=c&state=x';

  it('keeps it out of the form and links back from the done page', () => {
    expect(
      renderRequiredActionsForm('acme', 'k', ['update-password'], true, undefined, EN).body,
    ).not.toContain('return_to');
    expect(renderRequiredActionsSucceededPage([], way, EN).body)
      .toBe(`<h1>Your account is updated</h1>
<p class="links">
<a href="/tenants/acme/protocol/openid-connect/auth?client_id=c&amp;state=x">Continue to sign in</a>
</p>`);
    expect(renderRequiredActionsSucceededPage(['configure-passkey'], way, EN).body).toContain(
      '<li>Register a passkey</li>\n</ul>\n<p class="links">',
    );
    expect(renderRequiredActionsSucceededPage([], null, EN).body).not.toContain('links');
  });
});
