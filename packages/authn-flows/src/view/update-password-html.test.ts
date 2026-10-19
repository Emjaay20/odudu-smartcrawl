import { evaluatePassword, REUSED_PASSWORD } from '@odudu/domain-identity';
import { DEFAULT_PAGE_LOCALE, PASSWORD_TOO_LONG } from '@odudu/kernel';
import { describe, expect, it, vi } from 'vitest';
import { type PasswordViolation } from '#/schema/password-violation';
import { en } from '#/view/messages';
import { renderUpdatePasswordPage } from '#/view/update-password-html';
import { ARABIC, FRENCH } from '@odudu/testkit/i18n';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'updatePassword.title': 'Changez votre mot de passe',
    'updatePassword.rule.minLength':
      'Le mot de passe doit comporter au moins {min, number, ::group-off} caractères.',
    'updatePassword.rule.maxLength':
      'Le mot de passe ne doit pas dépasser {max, number, ::group-off} caractères.',
    'updatePassword.rule.requireDigit': 'Le mot de passe doit contenir un chiffre.',
    'updatePassword.rule.notReused': 'Le mot de passe ne doit pas avoir déjà servi.',
  });
});

const RULES: readonly PasswordViolation[] = [
  { rule: 'min-length', message: 'dev', minLength: 12 },
  { rule: 'max-length', message: 'dev' },
  { rule: 'require-digit', message: 'dev' },
  { rule: 'require-uppercase', message: 'dev' },
  { rule: 'require-lowercase', message: 'dev' },
  { rule: 'require-special', message: 'dev' },
  { rule: 'not-username', message: 'dev' },
  { rule: 'not-email', message: 'dev' },
  { rule: 'not-reused', message: 'dev' },
  { rule: 'superseded', message: 'dev' },
];

// Every rule code the domain can report must have a catalogue entry here, or
// the page falls back to the developer sentence for it.
describe('every rule the domain reports is worded by the catalogue', () => {
  const policy = {
    minLength: 300,
    requireDigit: true,
    requireUppercase: true,
    requireLowercase: true,
    requireSpecial: true,
    notUsername: true,
    notEmail: true,
    historyDepth: 1,
    maxAgeDays: 0,
  };
  const subject = { username: 'a', email: 'a@example.com' };

  it('renders each reported rule without the developer fallback', () => {
    const reported = [
      ...evaluatePassword('a'.repeat(400), policy, subject),
      ...evaluatePassword('A'.repeat(400), policy, subject),
      ...evaluatePassword('a', policy, subject),
      REUSED_PASSWORD,
      PASSWORD_TOO_LONG,
    ];
    expect([...new Set(reported.map((violation) => violation.rule))].sort()).toEqual([
      'max-length',
      'min-length',
      'not-email',
      'not-reused',
      'not-username',
      'require-digit',
      'require-lowercase',
      'require-special',
      'require-uppercase',
    ]);
    for (const { rule, message } of reported) {
      const { body } = renderUpdatePasswordPage(
        'd',
        's',
        [{ rule, message, minLength: policy.minLength }],
        DEFAULT_PAGE_LOCALE,
      );
      // The intro isolates the tenant; only a developer fallback would add another.
      expect(body.replace(/<header[\s\S]*?<\/header>/u, ''), rule).not.toContain('<bdi>');
    }
  });
});

describe('renderUpdatePasswordPage', () => {
  it('posts the new password to the update-password action with the session it was given', () => {
    const rendered = renderUpdatePasswordPage('demo', 'sess-1', undefined, DEFAULT_PAGE_LOCALE);
    expect(rendered.html).toContain(
      'action="/tenants/demo/login-actions/required-action?action=update-password"',
    );
    expect(rendered.html).toContain('name="auth_session_id" value="sess-1"');
    expect(rendered.html).toContain('autocomplete="new-password"');
    expect(rendered.title).toBe('Change your password');
    expect(rendered.script).toBeNull();
  });

  it('keeps the English markup exactly', () => {
    expect(
      renderUpdatePasswordPage(
        'acme',
        'sess-1',
        [
          { rule: 'min-length', message: 'dev', minLength: 12 },
          { rule: 'require-digit', message: 'dev' },
        ],
        DEFAULT_PAGE_LOCALE,
      ).body,
    ).toBe(`<header class="intro">
<h1>Change your password</h1>
<p class="tenant"><bdi>acme</bdi></p>
</header>
<p>This account needs a new password before you can continue.</p>
<div class="alert" role="alert">
<ul>
<li>Password must be at least 12 characters long.</li>
<li>Password must contain a digit.</li>
</ul>
</div>
<form method="post" action="/tenants/acme/login-actions/required-action?action=update-password">
  <input type="hidden" name="auth_session_id" value="sess-1">
  <label>New password <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">Update password</button>
</form>`);
  });

  it('lists no violations when there are none', () => {
    expect(
      renderUpdatePasswordPage('demo', 's', undefined, DEFAULT_PAGE_LOCALE).html,
    ).not.toContain('<ul>');
  });

  it('reads every rule from the catalogue by its code, with its numbers', () => {
    const { body } = renderUpdatePasswordPage('demo', 's', RULES, DEFAULT_PAGE_LOCALE);
    expect(body).toContain('<li>Password must be at least 12 characters long.</li>');
    expect(body).toContain('<li>Password must be at most 256 characters long.</li>');
    expect(body).toContain(`<li>${en['updatePassword.rule.notReused']}</li>`);
    expect(body).toContain(`<li>${en['updatePassword.rule.superseded']}</li>`);
    expect(body).not.toContain('dev');
  });

  it('writes a long minimum without a thousands separator', () => {
    expect(
      renderUpdatePasswordPage(
        'd',
        's',
        [{ rule: 'min-length', message: 'x', minLength: 1000 }],
        FRENCH,
      ).body,
    ).toContain('au moins 1000 caractères');
  });

  it('never states a minimum it was not given', () => {
    const { body } = renderUpdatePasswordPage(
      'demo',
      's',
      [{ rule: 'min-length', message: 'Too short' }],
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain('<li><bdi>Too short</bdi></li>');
    expect(body).not.toContain('at least 0');
  });

  it('shows an unknown rule by its developer message, isolated', () => {
    const { body } = renderUpdatePasswordPage(
      'demo',
      's',
      [{ rule: 'future-rule', message: 'Must be <b>blue</b>' }],
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain('<li><bdi>Must be &lt;b&gt;blue&lt;/b&gt;</bdi></li>');
    expect(body).not.toContain('<b>');
  });

  it('does not mistake a rule named like an object member for a catalogue entry', () => {
    const { body } = renderUpdatePasswordPage(
      'demo',
      's',
      [{ rule: 'constructor', message: 'dev' }],
      DEFAULT_PAGE_LOCALE,
    );
    expect(body).toContain('<li><bdi>dev</bdi></li>');
  });

  it('renders each rule it has in French, and English for the keys the fixture lacks', () => {
    const page = renderUpdatePasswordPage('demo', 's', RULES, FRENCH);
    expect(page.title).toBe('Changez votre mot de passe');
    expect(page.html).toContain('<html lang="fr" dir="ltr">');
    expect(page.body).toContain('<li>Le mot de passe doit comporter au moins 12 caractères.</li>');
    expect(page.body).toContain('<li>Le mot de passe ne doit pas dépasser 256 caractères.</li>');
    expect(page.body).toContain('<li>Le mot de passe doit contenir un chiffre.</li>');
    expect(page.body).toContain('<li>Le mot de passe ne doit pas avoir déjà servi.</li>');
    expect(page.body).toContain(`<li>${en['updatePassword.rule.requireUppercase']}</li>`);
    expect(page.body).toContain(`<h1>Changez votre mot de passe</h1>`);
  });

  it('writes lang and dir for a right-to-left locale', () => {
    expect(renderUpdatePasswordPage('demo', 's', [], ARABIC).html).toContain(
      '<html lang="ar" dir="rtl">',
    );
  });

  it('escapes the tenant, the session and each unknown-rule message', () => {
    const { html } = renderUpdatePasswordPage(
      '<b>t</b>',
      '"><i>',
      [{ rule: 'x', message: '<img src=x onerror=1>' }],
      DEFAULT_PAGE_LOCALE,
    );
    expect(html).not.toContain('<b>t</b>');
    expect(html).not.toContain('"><i>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('<bdi>&lt;img src=x onerror=1&gt;</bdi>');
  });
});
