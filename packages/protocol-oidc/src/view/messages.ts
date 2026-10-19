import { createCatalogue, type Catalogue, type Messages, type MessageValues } from '@odudu/i18n';
import { type PageLocale } from '@odudu/kernel';
import { escapeHtml } from '#/view/document';

// Every sentence a page of this package shows, keyed by what it is for. `en`
// is the source and complete; another locale may omit a key and shows English
// for it. A message is plain text: markup stays in the renderer.
export const en = {
  'throttled.title': 'Too many attempts',
  'throttled.retryAfter': 'Try again in {seconds, plural, one {# second} other {# seconds}}.',
  'throttled.goBack': 'Go back to the previous page when the time is up.',

  'error.title': 'Sign-in error',
  'error.heading': "Can't continue",
  'error.wayOn.restart': 'Start sign-in again',
  'error.wayOn.return': 'Return to the application',
  'error.signInExpired': 'This sign-in attempt is no longer valid. Go back and start again.',
  'error.noPendingAction': 'This account has no such pending action.',
  'error.pendingActionNotReady': 'That pending action cannot be completed here yet.',
  'error.unknownTenant': 'Unknown tenant.',
  'error.accountNotSignedIn': 'That account is not one this browser is currently signed in to.',

  'emailUnverified.title': 'Verify your email',
  'emailUnverified.heading': "Can't sign in yet",
  'emailUnverified.body':
    'You need to verify your email address before you can sign in. {mail, select, sent {We sent a link to the address on this account — follow it, then sign in again.} other {This account has no email address on file, so there is nothing to verify yet. Contact an administrator.}}',

  'login.title': 'Sign in',
  'login.submit': 'Sign in',
  'login.otp.title': 'Enter your authentication code',
  'login.recoveryCode.title': 'Enter a recovery code',
  'login.verify': 'Verify',
  'login.username': 'Username',
  'login.usernameOrEmail': 'Username or email',
  'login.password': 'Password',
  'login.otp.code': 'Code from your app',
  'login.recoveryCode.label': 'Or a recovery code',
  'login.rememberMe': 'Remember me',
  'login.unsupportedStep': 'Unsupported sign-in step: {form}',
  'login.passkey.submit': 'Sign in with a passkey',
  'login.passkey.needsScript':
    'Signing in with a passkey needs JavaScript, because only the browser can talk to your authenticator. Use your username and password above.',
  'login.passkey.failed': 'Your device did not finish signing in — {reason}. You can try again.',
  'login.passkey.cancelled': 'the request was cancelled',
  'login.passkey.notOffered': 'this server is not offering passkeys',
  'login.refusal.signInFailed': 'Sign-in failed. Check your details and try again.',
  'login.refusal.codeFailed': 'That code did not work. Check it and try again.',
  'login.refusal.recoveryCodeFailed': 'That recovery code did not work. Check it and try again.',
  'login.refusal.alreadyUsedRecoveryCode':
    'You have already used that recovery code. Try another one from your list.',

  'consent.title': 'Allow access?',
  'consent.heading': '{client} is asking for access',
  'consent.link.about': 'About {client}',
  'consent.link.privacy': 'Privacy policy',
  'consent.link.terms': 'Terms of service',
  'consent.scope.offlineAccess': '{label} — grants ongoing access, even while you are not present',
  'consent.allow': 'Allow',
  'consent.deny': 'Deny',

  'logout.confirm.title': 'Sign out?',
  'logout.confirm.body': 'Signing out ends this session for every application that uses it.',
  'logout.confirm.submit': 'Sign out',
  'logout.noSession.title': 'Already signed out',
  'logout.noSession.body': 'There is no active session to end.',
  'logout.done.title': 'Signed out',
  'logout.done.body': 'You have been signed out.',
  'logout.redirectRefused.body':
    'You have been signed out, but the address given to return to afterward is not one this client has registered, so it has not been used.',
  'logout.unauthenticated.title': "Can't sign out",
  'logout.unauthenticated.body': 'This sign-out attempt is no longer valid. Go back and try again.',

  'selectAccount.title': 'Choose an account',
  'selectAccount.useOther': 'Use another account',
};

export type MessageId = keyof typeof en;

// Wraps text somebody else wrote (a client's name, an account name, an
// administrator's label) so its direction cannot reorder the text around it.
export function bdi(value: string): string {
  return `<bdi>${escapeHtml(value)}</bdi>`;
}

// A user's own text goes into a message as a marker the escaped result is
// searched for, so the whole message is escaped once and each isolated value
// is escaped once, inside its own <bdi>.
const OPEN = '';
const CLOSE = '';
const MARKER = /([^]*)/gu;

export interface Translators {
  readonly catalogue: Catalogue<typeof en>;
  readonly t: (locale: PageLocale, id: MessageId, values?: MessageValues) => string;
  readonly tHtml: (
    locale: PageLocale,
    id: MessageId,
    values?: MessageValues,
    isolated?: Readonly<Record<string, string>>,
  ) => string;
}

export function translators(byLocale: Messages<typeof en>): Translators {
  const catalogue = createCatalogue<typeof en>(byLocale);
  const t: Translators['t'] = (locale, id, values) => catalogue.format(locale.tag, id, values);
  const tHtml: Translators['tHtml'] = (locale, id, values = {}, isolated = {}) => {
    const markers = Object.fromEntries(
      Object.keys(isolated).map((name) => [name, `${OPEN}${name}${CLOSE}`]),
    );
    return escapeHtml(t(locale, id, { ...values, ...markers })).replace(
      MARKER,
      (_, name: string) => (Object.hasOwn(isolated, name) ? bdi(isolated[name] ?? '') : ''),
    );
  };
  return { catalogue, t, tHtml };
}

const shipped = translators({ en });

// `t` is plain text, for a title the shell escapes and for tests; `tHtml` is
// escaped markup for a body, with `isolated` values wrapped in <bdi>.
export const catalogue = shipped.catalogue;
export const t = shipped.t;
export const tHtml = shipped.tHtml;
