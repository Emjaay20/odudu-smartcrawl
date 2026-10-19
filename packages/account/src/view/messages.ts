import { createTranslators, type Messages, type Translators } from '@odudu/i18n';
import { escapeHtml } from '#/view/document';

// Every sentence an account page shows, keyed by what it is for. `en` is the
// source and complete; another locale may omit a key and shows English for
// it. A message is plain text: markup stays in the renderer.
export const en = {
  'verification.succeeded.title': 'Email verified',
  'verification.succeeded.heading': 'Your email address is verified',
  'verification.succeeded.next': 'You can close this page and sign in.',
  'verification.failed.title': "Can't verify this link",
  'verification.failed.heading': "This link can't be used",
  'verification.failed.reason':
    'It may have already been used, expired, or no longer matches your email address. Request a new verification email and try again.',
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
