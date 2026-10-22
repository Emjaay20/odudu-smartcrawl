import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import {
  renderResetLinkFailedPage,
  renderResetPasswordForm,
  renderResetPasswordSucceededPage,
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
    const page = renderResetRequestForm('acme', {}, EN);
    expect(page.title).toBe('Forgot your password?');
    expect(page.body).toContain('name="email"');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetRequestForm('acme', {}, EN).body).toBe(`<header class="intro">
<h1>Forgot your password?</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
<form method="post" action="/tenants/acme/login-actions/reset-password">
  <label>Email <input type="email" name="email" autocomplete="email"></label>
  <button type="submit">Send reset link</button>
</form>`);
  });

  it('links back to sign-in and carries the way in the form', () => {
    const way = '/tenants/acme/protocol/openid-connect/auth?client_id=portal&state=x';
    const { body } = renderResetRequestForm('acme', { signInPath: way }, EN);
    expect(body).toContain(
      '<input type="hidden" name="return_to" value="/tenants/acme/protocol/openid-connect/auth?client_id=portal&amp;state=x">',
    );
    expect(body).toContain(
      '<p class="links">\n<a href="/tenants/acme/protocol/openid-connect/auth?client_id=portal&amp;state=x">Back to sign in</a>\n</p>',
    );
  });

  it('comes back in place with the message, the field marked and focused', () => {
    const { body } = renderResetRequestForm('acme', { emailRequired: true }, EN);
    expect(body).toContain(`<div class="alert" role="alert" id="form-error">
<ul>
<li id="form-error-0">Email is required.</li>
</ul>
</div>
<form`);
    expect(body).toContain(
      'name="email" autocomplete="email" aria-invalid="true" aria-describedby="form-error-0" autofocus>',
    );
  });

  it('gives a typed address back, escaped and bounded', () => {
    expect(renderResetRequestForm('acme', { email: '"><i>' }, EN).body).toContain(
      'value="&quot;&gt;&lt;i&gt;"',
    );
    expect(renderResetRequestForm('acme', { email: 'x'.repeat(600) }, EN).body).not.toContain(
      'xxxxxxxx',
    );
  });

  it('reads French, and English for what the fixture lacks', () => {
    const page = renderResetRequestForm('acme', {}, FRENCH);
    expect(page.title).toBe('Mot de passe oublié ?');
    expect(page.body).toContain(`<label>${en['reset.request.email']} <input`);
  });

  it('writes the tenant into the action as a path segment', () => {
    expect(renderResetRequestForm('a b"><b>', {}, EN).html).toContain(
      'action="/tenants/a%20b%22%3E%3Cb%3E/login-actions/reset-password"',
    );
  });
});

describe('renderResetRequestedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetRequestedPage(null, EN);
    expect(page.title).toBe('Check your email');
    expect(page.body).toContain('we&#39;ve sent a link');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetRequestedPage(null, EN).body).toBe(`<h1>Check your email</h1>
<p>If that address has an account, we&#39;ve sent a link to reset its password.</p>`);
  });

  it('links back to sign-in when the way was carried', () => {
    expect(
      renderResetRequestedPage('/tenants/acme/protocol/openid-connect/auth?a=b', EN).body,
    ).toContain(
      '<p class="links">\n<a href="/tenants/acme/protocol/openid-connect/auth?a=b">Back to sign in</a>\n</p>',
    );
  });

  it('reads French, and English for what the fixture lacks', () => {
    const page = renderResetRequestedPage(null, FRENCH);
    expect(page.body).toContain('<p>Si cette adresse a un compte, nous avons envoyé');
    expect(page.title).toBe(en['reset.requested.title']);
  });
});

describe('renderResetRequestFailedPage', () => {
  it('stays a page for the refusal that is not about the field, with the way to try again', () => {
    const page = renderResetRequestFailedPage('acme', null, EN);
    expect(page.title).toBe("Can't send a reset link");
    expect(page.body).toBe(`<h1>Can&#39;t send a reset link</h1>
<p>Password reset is temporarily unavailable. Try again later.</p>
<p class="links">
<a href="/tenants/acme/login-actions/reset-password">Try again</a>
</p>`);
    expectFragment(page);
  });

  it('keeps the way back through the retry and beside it', () => {
    const way = '/tenants/acme/protocol/openid-connect/auth?a=b';
    const { body } = renderResetRequestFailedPage('acme', way, EN);
    expect(body).toContain(
      `href="/tenants/acme/login-actions/reset-password?return_to=${encodeURIComponent(way)}">Try again</a>`,
    );
    expect(body).toContain(`<a href="${way}">Back to sign in</a>`);
  });

  it('reads French, and English for what the fixture lacks', () => {
    expect(renderResetRequestFailedPage('acme', null, FRENCH).body).toContain(
      en['reset.requestFailed.unavailable'],
    );
  });
});

describe('renderResetPasswordForm', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderResetPasswordForm('acme', 'token-key', undefined, EN);
    expect(page.title).toBe('Choose a new password');
    expect(page.body).toContain('value="token-key"');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetPasswordForm('acme', 'token-key', undefined, EN).body)
      .toBe(`<header class="intro">
<h1>Choose a new password</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
<form method="post" action="/tenants/acme/login-actions/action-token">
  <input type="hidden" name="key" value="token-key">
  <label>New password <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">Reset password</button>
</form>`);
  });

  it('comes back in place with every broken rule, the password field marked and focused', () => {
    const { body } = renderResetPasswordForm(
      'acme',
      'token-key',
      [
        { rule: 'min-length', message: 'dev', minLength: 8 },
        { rule: 'not-reused', message: 'dev' },
      ],
      EN,
    );
    expect(body).toContain(`<div class="alert" role="alert" id="form-error">
<ul>
<li id="form-error-0">Password must be at least 8 characters long.</li>
<li id="form-error-1">Password must not be one you have used before.</li>
</ul>
</div>
<form`);
    expect(body).toContain('<input type="hidden" name="key" value="token-key">');
    expect(body).toContain(
      'autocomplete="new-password" aria-invalid="true" aria-describedby="form-error-0 form-error-1" autofocus>',
    );
    expect(body).not.toMatch(/name="password"[^>]*value=/u);
  });

  it('says a password is required, in French where the fixture has it', () => {
    expect(renderResetPasswordForm('acme', 'k', 'required', EN).body).toContain(
      '<li id="form-error-0">A new password is required.</li>',
    );
    expect(renderResetPasswordForm('acme', 'k', 'required', FRENCH).body).toContain(
      '<li id="form-error-0">Un nouveau mot de passe est obligatoire.</li>',
    );
  });

  it('reads French rules, English for the rest, and isolates an unknown rule', () => {
    const { body } = renderResetPasswordForm(
      'acme',
      'k',
      [
        { rule: 'min-length', message: 'dev', minLength: 1000 },
        { rule: 'require-digit', message: 'dev' },
        { rule: 'x', message: '<b>y</b>' },
      ],
      FRENCH,
    );
    expect(body).toContain('>Le mot de passe doit comporter au moins 1000 caractères.</li>');
    expect(body).toContain(`>${en['password.rule.requireDigit']}</li>`);
    expect(body).toContain('<li id="form-error-2"><bdi>&lt;b&gt;y&lt;/b&gt;</bdi></li>');
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderResetPasswordForm('acme', 'k', [], ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });

  it('reads French, keeps the key and tenant escaped, and has no script', () => {
    const page = renderResetPasswordForm('<t>', '"><img src=x>', undefined, FRENCH);
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
    const page = renderResetLinkFailedPage(null, EN);
    expect(page.title).toBe("Can't use this link");
    expect(page.body).toContain('This link can&#39;t be used');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderResetLinkFailedPage(null, EN).body).toBe(`<h1>This link can&#39;t be used</h1>
<p>It may have already been used or expired. Request a new one and try again.</p>`);
  });

  it('offers a new link only when told where to ask for one', () => {
    expect(renderResetLinkFailedPage('/tenants/acme/login-actions/reset-password', EN).body).toBe(
      `<h1>This link can&#39;t be used</h1>
<p>It may have already been used or expired. Request a new one and try again.</p>
<p class="links">
<a href="/tenants/acme/login-actions/reset-password">Request a new link</a>
</p>`,
    );
  });

  it('reads French, and English for what the fixture lacks', () => {
    const page = renderResetLinkFailedPage(null, FRENCH);
    expect(page.body).toContain('<h1>Ce lien n&#39;est pas utilisable</h1>');
    expect(page.body).toContain(en['reset.linkFailed.reason']);
  });
});
