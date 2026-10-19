import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';
import { describe, expect, it, vi } from 'vitest';
import { type PasswordViolation } from '#/schema/password-violation';
import { en } from '#/view/messages';
import { renderUpdatePasswordPage } from '#/view/update-password-html';
import { ARABIC, FRENCH } from '#test/fr-catalogue';

vi.mock('#/view/messages', async (importOriginal) => {
  const { withFrench } = await import('#test/fr-catalogue');
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
    ).toBe(`<h1>Change your password</h1>
<p>This account needs a new password before you can continue.</p>
<ul>
<li>Password must be at least 12 characters long.</li>
<li>Password must contain a digit.</li>
</ul>
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
