import { createTranslators, type Messages, type Translators } from '@odudu/i18n';
import { escapeHtml } from '#/view/document';

// Every sentence an authn-flows page shows, keyed by what it is for. `en` is
// the source and complete; another locale may omit a key and shows English
// for it. A message is plain text: markup stays in the renderer.
export const en = {
  'updatePassword.title': 'Change your password',
  'updatePassword.intro': 'This account needs a new password before you can continue.',
  'updatePassword.newPassword': 'New password',
  'updatePassword.submit': 'Update password',
  'updatePassword.rule.minLength':
    'Password must be at least {min, number, ::group-off} characters long.',
  'updatePassword.rule.maxLength':
    'Password must be at most {max, number, ::group-off} characters long.',
  'updatePassword.rule.requireDigit': 'Password must contain a digit.',
  'updatePassword.rule.requireUppercase': 'Password must contain an uppercase letter.',
  'updatePassword.rule.requireLowercase': 'Password must contain a lowercase letter.',
  'updatePassword.rule.requireSpecial': 'Password must contain a special character.',
  'updatePassword.rule.notUsername': 'Password must not contain the username.',
  'updatePassword.rule.notEmail': 'Password must not contain the email address.',
  'updatePassword.rule.notReused': 'Password must not be one you have used before.',
  'updatePassword.rule.superseded':
    'Your password was changed somewhere else before this form was submitted. Sign in again with the password you set there.',
};

export type MessageId = keyof typeof en;

export function translators(byLocale: Messages<typeof en>): Translators<typeof en> {
  return createTranslators(byLocale, escapeHtml);
}

const shipped = translators({ en });

export const catalogue = shipped.catalogue;
export const t = shipped.t;
export const tHtml = shipped.tHtml;
export const bdi = shipped.bdi;
