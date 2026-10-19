import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import {
  renderResetLinkFailedPage,
  renderResetPasswordForm,
  renderResetPasswordRequiredPage,
  renderResetPasswordSucceededPage,
  renderResetPasswordWeakPage,
  renderResetRequestedPage,
  renderResetRequestFailedPage,
  renderResetRequestForm,
} from '#/view/reset-html';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'reset.request.title': 'Mot de passe oublié ?',
    'reset.requested.next':
      'Si cette adresse a un compte, nous avons envoyé un lien pour réinitialiser son mot de passe.',
    'reset.requestFailed.emailRequired': "L'adresse e-mail est obligatoire.",
    'reset.form.newPassword': 'Nouveau mot de passe',
    'reset.linkFailed.heading': "Ce lien n'est pas utilisable",
    'reset.cannotReset.title': 'Impossible de réinitialiser votre mot de passe',
    'reset.required.reason': 'Un nouveau mot de passe est obligatoire.',
    'password.rule.minLength':
      'Le mot de passe doit comporter au moins {min, number, ::group-off} caractères.',
  });
});

function expectFragment(page: { html: string; body: string }): void {
  expect(page.body).not.toContain('<!doctype');
  expect(page.body).not.toContain('<html');
  expect(page.html).toContain('<!doctype html>');
  expect(page.html).toContain(page.body);
}

const EN = DEFAULT_PAGE_LOCALE;

describe('renderResetRequestForm', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetRequestForm('acme', EN);
    expect(page.title).toBe('Forgot your password?');
    expect(page.body).toContain('name="email"');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetRequestForm('acme', EN).body).toBe(`<header class="intro">
<h1>Forgot your password?</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
<form method="post" action="/tenants/acme/login-actions/reset-password">
  <label>Email <input type="email" name="email" autocomplete="email"></label>
  <button type="submit">Send reset link</button>
</form>`);
  });

  it('reads French, and English for what the fixture lacks', () => {
    const page = renderResetRequestForm('acme', FRENCH);
    expect(page.title).toBe('Mot de passe oublié ?');
    expect(page.body).toContain(`<label>${en['reset.request.email']} <input`);
  });

  it('escapes the tenant in the action', () => {
    expect(renderResetRequestForm('"><b>', EN).html).not.toContain('<b>');
  });
});

describe('renderResetRequestedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetRequestedPage(EN);
    expect(page.title).toBe('Check your email');
    expect(page.body).toContain('we&#39;ve sent a link');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetRequestedPage(EN).body).toBe(`<h1>Check your email</h1>
<p>If that address has an account, we&#39;ve sent a link to reset its password.</p>`);
  });

  it('reads French, and English for what the fixture lacks', () => {
    const page = renderResetRequestedPage(FRENCH);
    expect(page.body).toContain('<p>Si cette adresse a un compte, nous avons envoyé');
    expect(page.title).toBe(en['reset.requested.title']);
  });
});

describe('renderResetRequestFailedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetRequestFailedPage('email_required', EN);
    expect(page.title).toBe("Can't send a reset link");
    expect(page.body).toContain('Email is required.');
    expectFragment(page);
  });

  it('keeps the English markup exactly for both refusals', () => {
    expect(renderResetRequestFailedPage('email_required', EN).body)
      .toBe(`<h1>Can&#39;t send a reset link</h1>
<p>Email is required.</p>`);
    expect(renderResetRequestFailedPage('unavailable', EN).body)
      .toBe(`<h1>Can&#39;t send a reset link</h1>
<p>Password reset is temporarily unavailable. Try again later.</p>`);
  });

  it('reads French, and English for what the fixture lacks', () => {
    expect(renderResetRequestFailedPage('email_required', FRENCH).body).toContain(
      '<p>L&#39;adresse e-mail est obligatoire.</p>',
    );
    expect(renderResetRequestFailedPage('unavailable', FRENCH).body).toContain(
      en['reset.requestFailed.unavailable'],
    );
  });
});

describe('renderResetPasswordForm', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetPasswordForm('acme', 'token-key', EN);
    expect(page.title).toBe('Choose a new password');
    expect(page.body).toContain('value="token-key"');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetPasswordForm('acme', 'token-key', EN).body).toBe(`<header class="intro">
<h1>Choose a new password</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
<form method="post" action="/tenants/acme/login-actions/action-token">
  <input type="hidden" name="key" value="token-key">
  <label>New password <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">Reset password</button>
</form>`);
  });

  it('reads French, keeps the key and tenant escaped, and has no script', () => {
    const page = renderResetPasswordForm('<t>', '"><img src=x>', FRENCH);
    expect(page.body).toContain('<label>Nouveau mot de passe <input');
    expect(page.html).not.toContain('<img src=x>');
    expect(page.html).not.toContain('<t>');
    expect(page.body).toContain('value="&quot;&gt;&lt;img src=x&gt;"');
    expect(page.script).toBeNull();
  });
});

describe('renderResetPasswordSucceededPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetPasswordSucceededPage(EN);
    expect(page.title).toBe('Password reset');
    expect(page.body).toContain('Your password has been reset');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetPasswordSucceededPage(EN).body).toBe(`<h1>Your password has been reset</h1>
<p>You can close this page and sign in with your new password.</p>`);
  });
});

describe('renderResetLinkFailedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetLinkFailedPage(EN);
    expect(page.title).toBe("Can't use this link");
    expect(page.body).toContain('This link can&#39;t be used');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetLinkFailedPage(EN).body).toBe(`<h1>This link can&#39;t be used</h1>
<p>It may have already been used or expired. Request a new one and try again.</p>`);
  });

  it('reads French, and English for what the fixture lacks', () => {
    const page = renderResetLinkFailedPage(FRENCH);
    expect(page.body).toContain('<h1>Ce lien n&#39;est pas utilisable</h1>');
    expect(page.body).toContain(en['reset.linkFailed.reason']);
  });
});

describe('renderResetPasswordWeakPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetPasswordWeakPage(
      [{ rule: 'min-length', message: 'dev', minLength: 8 }],
      EN,
    );
    expect(page.title).toBe("Can't reset your password");
    expect(page.body).toContain('Password must be at least 8 characters long.');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(
      renderResetPasswordWeakPage(
        [
          { rule: 'min-length', message: 'dev', minLength: 8 },
          { rule: 'not-reused', message: 'dev' },
        ],
        EN,
      ).body,
    ).toBe(`<h1>Can&#39;t reset your password</h1>
<ul>
<li>Password must be at least 8 characters long.</li>
<li>Password must not be one you have used before.</li>
</ul>`);
  });

  it('reads French rules, English for the rest, and isolates an unknown rule', () => {
    const { body, title } = renderResetPasswordWeakPage(
      [
        { rule: 'min-length', message: 'dev', minLength: 1000 },
        { rule: 'require-digit', message: 'dev' },
        { rule: 'x', message: '<b>y</b>' },
      ],
      FRENCH,
    );
    expect(title).toBe('Impossible de réinitialiser votre mot de passe');
    expect(body).toContain('<li>Le mot de passe doit comporter au moins 1000 caractères.</li>');
    expect(body).toContain(`<li>${en['password.rule.requireDigit']}</li>`);
    expect(body).toContain('<li><bdi>&lt;b&gt;y&lt;/b&gt;</bdi></li>');
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderResetPasswordWeakPage([], ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });
});

describe('renderResetPasswordRequiredPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetPasswordRequiredPage(EN);
    expect(page.title).toBe("Can't reset your password");
    expect(page.body).toContain('A new password is required.');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetPasswordRequiredPage(EN).body).toBe(`<h1>Can&#39;t reset your password</h1>
<p>A new password is required.</p>`);
  });

  it('reads French', () => {
    expect(renderResetPasswordRequiredPage(FRENCH).body).toContain(
      '<p>Un nouveau mot de passe est obligatoire.</p>',
    );
  });
});
