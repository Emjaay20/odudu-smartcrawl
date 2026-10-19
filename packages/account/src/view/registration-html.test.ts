import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';
import { describe, expect, it, vi } from 'vitest';
import { en } from '#/view/messages';
import {
  renderRegistrationFailedPage,
  renderRegistrationForm,
  renderRegistrationSucceededPage,
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

describe('renderRegistrationForm', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderRegistrationForm('acme', DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Create account');
    expect(page.body).toContain('name="username"');
    expectFragment(page);
  });

  it('keeps the English markup exactly', () => {
    expect(renderRegistrationForm('acme', DEFAULT_PAGE_LOCALE).body).toBe(`<header class="intro">
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

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRegistrationForm('acme', FRENCH);
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.title).toBe('Créer un compte');
    expect(page.body).toContain(`<label>Nom d&#39;utilisateur <input`);
    expect(page.body).toContain(`<label>${en['registration.email']} <input`);
    expect(page.body).toContain(`>${en['registration.submit']}</button>`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRegistrationForm('acme', ARABIC).html).toContain('<html lang="ar" dir="rtl">');
  });

  it('escapes the tenant name in the action', () => {
    const { html } = renderRegistrationForm('"><script>1</script>', DEFAULT_PAGE_LOCALE);
    expect(html).not.toContain('<script>1');
    expect(html).toContain('/tenants/&quot;&gt;&lt;script&gt;1&lt;/script&gt;/login-actions');
  });
});

describe('renderRegistrationFailedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderRegistrationFailedPage({ refusal: 'username_taken' }, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe("Can't create this account");
    expect(page.body).toContain('That username is already taken.');
    expectFragment(page);
  });

  it('keeps the English markup exactly, for a refusal and for the rules', () => {
    expect(renderRegistrationFailedPage({ refusal: 'email_taken' }, DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>Can&#39;t create this account</h1>
<ul>
<li>That email address is already registered.</li>
</ul>`);
    expect(
      renderRegistrationFailedPage(
        {
          violations: [
            { rule: 'min-length', message: 'dev', minLength: 12 },
            { rule: 'require-digit', message: 'dev' },
          ],
        },
        DEFAULT_PAGE_LOCALE,
      ).body,
    ).toBe(`<h1>Can&#39;t create this account</h1>
<ul>
<li>Password must be at least 12 characters long.</li>
<li>Password must contain a digit.</li>
</ul>`);
  });

  it('words every refusal from the catalogue', () => {
    const wording = {
      fields_required: en['registration.refusal.fieldsRequired'],
      email_taken: en['registration.refusal.emailTaken'],
      username_taken: en['registration.refusal.usernameTaken'],
      invalid_email: en['registration.refusal.invalidEmail'],
      invalid_username: en['registration.refusal.invalidUsername'],
      unavailable: en['registration.refusal.unavailable'],
    } as const;
    for (const [refusal, text] of Object.entries(wording)) {
      const { body } = renderRegistrationFailedPage(
        { refusal: refusal as keyof typeof wording },
        DEFAULT_PAGE_LOCALE,
      );
      expect(body, refusal).toContain(text.replace(/'/g, '&#39;'));
    }
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRegistrationFailedPage({ refusal: 'username_taken' }, FRENCH);
    expect(page.title).toBe('Impossible de créer ce compte');
    expect(page.body).toContain('<li>Ce nom d&#39;utilisateur est déjà pris.</li>');
    const rules = renderRegistrationFailedPage(
      {
        violations: [
          { rule: 'min-length', message: 'dev', minLength: 1000 },
          { rule: 'require-digit', message: 'dev' },
        ],
      },
      FRENCH,
    );
    expect(rules.body).toContain(
      '<li>Le mot de passe doit comporter au moins 1000 caractères.</li>',
    );
    expect(rules.body).toContain(`<li>${en['password.rule.requireDigit']}</li>`);
  });

  it('shows a rule it has no wording for by its developer message, isolated and escaped', () => {
    const { body } = renderRegistrationFailedPage(
      { violations: [{ rule: 'future', message: '<img src=x onerror=1>' }] },
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain('<li><bdi>&lt;img src=x onerror=1&gt;</bdi></li>');
    expect(body).not.toContain('<img');
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRegistrationFailedPage({ refusal: 'email_taken' }, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });
});

describe('renderRegistrationSucceededPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderRegistrationSucceededPage(false, DEFAULT_PAGE_LOCALE);
    expect(page.title).toBe('Account created');
    expect(page.body).toContain('You can now sign in.');
    expectFragment(page);
  });

  it('keeps the English markup exactly, with and without verification', () => {
    expect(renderRegistrationSucceededPage(false, DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>Account created</h1>
<p>You can now sign in.</p>`);
    expect(renderRegistrationSucceededPage(true, DEFAULT_PAGE_LOCALE).body)
      .toBe(`<h1>Account created</h1>
<p>Check your email for a link to verify your address before you can sign in.</p>`);
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const page = renderRegistrationSucceededPage(false, FRENCH);
    expect(page.body).toContain('<p>Vous pouvez maintenant vous connecter.</p>');
    expect(page.title).toBe(en['registration.succeeded.title']);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderRegistrationSucceededPage(true, ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });
});
