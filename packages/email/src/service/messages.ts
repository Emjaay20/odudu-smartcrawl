import { createTranslators, type Messages, type Translators } from '@odudu/i18n';
import { escapeHtml } from '#/service/escape';

// Every sentence a mail says, keyed by what it is for. `en` is the source and
// complete; another locale may omit a key and shows English for it. A message
// is plain text: markup stays in the template, and the link is never a message.
export const en = {
  'mail.notRequested': 'If you did not request this, you can ignore this message.',
  'verify.subject': 'Verify your {tenant} account',
  'verify.text': 'Confirm your email address for {tenant} by visiting this link:',
  'verify.html': 'Confirm your email address for {tenant} by visiting {link}.',
  'reset.subject': 'Reset your {tenant} password',
  'reset.text': 'Reset your password for {tenant} by visiting this link:',
  'reset.html': 'Reset your password for {tenant} by visiting {link}.',
  'actions.subject': 'Update your {tenant} account',
  'actions.text': 'Your administrator asks you to update your {tenant} account:',
  'actions.textLink': 'Do so by visiting this link:',
  'actions.html': 'Do so by visiting {link}.',
  'actions.ignore': 'If you were not expecting this, you can ignore this message.',
  'notice.contact': 'If you did not expect this, contact your administrator.',
  'factorRemoved.subject': 'A sign-in method was removed from your {tenant} account',
  'factorRemoved.totp':
    'An administrator removed the authenticator app from your {tenant} account.',
  'factorRemoved.webauthn': 'An administrator removed a passkey from your {tenant} account.',
  'factorRemoved.codes': 'Your recovery codes were removed with it, and no longer work.',
  'recoveryRevoked.subject': 'Your {tenant} recovery codes were revoked',
  'recoveryRevoked.text':
    'An administrator revoked the recovery codes on your {tenant} account. The old codes no longer work.',
  'recoveryRevoked.newSet': 'You will be asked to save a new set the next time you sign in.',
  'smtpTest.subject': 'Odudu SMTP test',
  'smtpTest.text': 'This is a test message from Odudu.',
  'action.update-password': 'Choose a new password',
  'action.configure-totp': 'Set up an authenticator app',
  'action.configure-passkey': 'Register a passkey',
  'action.generate-recovery-codes': 'Save a set of recovery codes',
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
