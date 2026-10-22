import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import {
  renderRegistrationFailedPage,
  renderRegistrationForm,
  renderRegistrationSucceededPage,
  type RegistrationFailure,
} from '#/view/registration-html';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'registration.title': 'Créer un compte',
    'registration.username': "Nom d'utilisateur",
    'registration.failed.title': 'Impossible de créer ce compte',
    'registration.refusal.usernameTaken': "Ce nom d'utilisateur est déjà pris.",
    'registration.succeeded.signIn': 'Vous pouvez maintenant vous connecter.',
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

const SIGN_IN =
  '/tenants/acme/protocol/openid-connect/auth?response_type=code&client_id=portal&state=a%20b';

describe('renderRegistrationForm', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderRegistrationForm('acme', {}, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Create account');
    expect(page.body).toContain('name="username"');
    expectFragment(page);
  });

  it('keeps the English markup exactly, with no way back when none was carried', () => {
    expect(renderRegistrationForm('acme', {}, DEFAULT_PAGE_LOCALE).body)
      .toBe(`<header class="intro">
<h1>Create account</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
<form method="post" action="/tenants/acme/login-actions/registration">
  <label>Username <input type="text" name="username" autocomplete="username"></label>
  <label>Email <input type="email" name="email" autocomplete="email"></label>
  <label>Password <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">Create account</button>
</form>`);
  });

  it('links back to sign-in and carries the way in the form', () => {
    const { body } = renderRegistrationForm('acme', { signInPath: SIGN_IN }, DEFAULT_PAGE_LOCALE);
    const escaped = SIGN_IN.replaceAll('&', '&amp;');
    expect(body).toContain(`<input type="hidden" name="return_to" value="${escaped}">`);
    expect(body).toContain(`<p class="links">\n<a href="${escaped}">Back to sign in</a>\n</p>`);
  });

  it('re-renders the same form with the broken rules in one alert, the password never given back', () => {
    const failure: RegistrationFailure = {
      violations: [
        { rule: 'min-length', message: 'dev', minLength: 12 },
        { rule: 'require-digit', message: 'dev' },
      ],
    };
    const { body } = renderRegistrationForm(
      'acme',
      {
        failure,
        username: 'newcomer',
        email: 'new@example.test',
      },
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain(`<div class="alert" role="alert" id="form-error">
<ul>
<li id="form-error-0">Password must be at least 12 characters long.</li>
<li id="form-error-1">Password must contain a digit.</li>
</ul>
</div>
<form`);
    expect(body).toContain('name="username" autocomplete="username" value="newcomer">');
    expect(body).toContain('name="email" autocomplete="email" value="new@example.test">');
    expect(body).toContain(
      'name="password" autocomplete="new-password" aria-invalid="true" aria-describedby="form-error-0 form-error-1" autofocus>',
    );
    expect(body).not.toMatch(/name="password"[^>]*value=/u);
  });

  it('names each empty field, marks it and focuses the first', () => {
    const { body } = renderRegistrationForm(
      'acme',
      {
        failure: { missing: ['email', 'password'] },
        username: 'newcomer',
      },
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain('<li id="form-error-0">Enter an email address.</li>');
    expect(body).toContain('<li id="form-error-1">Enter a password.</li>');
    expect(body).toContain(
      'name="email" autocomplete="email" aria-invalid="true" aria-describedby="form-error-0" autofocus>',
    );
    expect(body).toContain(
      'name="password" autocomplete="new-password" aria-invalid="true" aria-describedby="form-error-1">',
    );
    expect(body).not.toMatch(/name="username"[^>]*aria-invalid/u);
  });

  it.each([
    ['username_taken', 'username', en['registration.refusal.usernameTaken']],
    ['invalid_username', 'username', en['registration.refusal.invalidUsername']],
    ['email_taken', 'email', en['registration.refusal.emailTaken']],
    ['invalid_email', 'email', en['registration.refusal.invalidEmail']],
  ] as const)('puts %s on the %s field', (refusal, field, text) => {
    const { body } = renderRegistrationForm(
      'acme',
      {
        failure: { refusal },
      },
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain(`<li id="form-error-0">${text}</li>`);
    expect(body).toMatch(
      new RegExp(
        `name="${field}"[^>]*aria-invalid="true" aria-describedby="form-error-0" autofocus>`,
        'u',
      ),
    );
  });

  it('escapes what it gives back and refuses a value too long to reflect', () => {
    const { body } = renderRegistrationForm(
      'acme',
      {
        failure: { refusal: 'email_taken' },
        username: '"><script>1</script>',
        email: 'x'.repeat(600),
      },
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).not.toContain('<script>1');
    expect(body).toContain('value="&quot;&gt;&lt;script&gt;1&lt;/script&gt;"');
    expect(body).not.toContain('xxxxxxxx');
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRegistrationForm('acme', {}, FRENCH);
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.title).toBe('Créer un compte');
    expect(page.body).toContain(`<label>Nom d&#39;utilisateur <input`);
    expect(page.body).toContain(`<label>${en['registration.email']} <input`);
    expect(page.body).toContain(`>${en['registration.submit']}</button>`);
    expect(
      renderRegistrationForm('acme', { failure: { refusal: 'username_taken' } }, FRENCH).body,
    ).toContain('<li id="form-error-0">Ce nom d&#39;utilisateur est déjà pris.</li>');
  });

  it('shows a rule it has no wording for by its developer message, isolated and escaped', () => {
    const { body } = renderRegistrationForm(
      'acme',
      {
        failure: { violations: [{ rule: 'future', message: '<img src=x onerror=1>' }] },
      },
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain('<li id="form-error-0"><bdi>&lt;img src=x onerror=1&gt;</bdi></li>');
    expect(body).not.toContain('<img');
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRegistrationForm('acme', {}, ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });

  it('escapes the tenant name in the action', () => {
    const { html } = renderRegistrationForm('"><script>1</script>', {}, DEFAULT_PAGE_LOCALE);
    expect(html).not.toContain('<script>1');
    expect(html).toContain('/tenants/&quot;&gt;&lt;script&gt;1&lt;/script&gt;/login-actions');
  });
});

describe('renderRegistrationFailedPage', () => {
  it('stays a page for the one refusal that is not about a field, with the way to try again', () => {
    const page = renderRegistrationFailedPage('acme', null, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe("Can't create this account");
    expect(page.body).toBe(`<h1>Can&#39;t create this account</h1>
<p>Registration is temporarily unavailable. Try again later.</p>
<p class="links">
<a href="/tenants/acme/login-actions/registration">Try again</a>
</p>`);
    expectFragment(page);
  });

  it('keeps the way back through the retry and beside it', () => {
    const { body } = renderRegistrationFailedPage('acme', SIGN_IN, DEFAULT_PAGE_LOCALE);
    const retry = `/tenants/acme/login-actions/registration?return_to=${encodeURIComponent(SIGN_IN)}`;
    expect(body).toContain(`<a href="${retry.replaceAll('&', '&amp;')}">Try again</a>`);
    expect(body).toContain(`>Back to sign in</a>`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRegistrationFailedPage('acme', null, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });
});

describe('renderRegistrationSucceededPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderRegistrationSucceededPage(false, null, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Account created');
    expect(page.body).toContain('You can now sign in.');
    expectFragment(page);
  });

  it('keeps the English markup exactly, with and without verification', () => {
    expect(renderRegistrationSucceededPage(false, null, DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>Account created</h1>
<p>You can now sign in.</p>`);
    expect(renderRegistrationSucceededPage(true, null, DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>Account created</h1>
<p>Check your email for a link to verify your address before you can sign in.</p>`);
  });

  it('links on to sign-in when the way was carried', () => {
    expect(renderRegistrationSucceededPage(false, SIGN_IN, DEFAULT_PAGE_LOCALE).body).toContain(
      `<p class="links">\n<a href="${SIGN_IN.replaceAll('&', '&amp;')}">Back to sign in</a>\n</p>`,
    );
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRegistrationSucceededPage(false, null, FRENCH);
    expect(page.body).toContain('<p>Vous pouvez maintenant vous connecter.</p>');
    expect(page.title).toBe(en['registration.succeeded.title']);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRegistrationSucceededPage(true, null, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });
});
