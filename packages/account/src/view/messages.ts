import { createTranslators, type Messages, type Translators } from '@odudu/i18n';
import { escapeHtml } from '#/view/document';

// Every sentence an account page shows, keyed by what it is for. `en` is the
// source and complete; another locale may omit a key and shows English for
// it. A message is plain text: markup stays in the renderer.
export const en = {
  'link.backToSignIn': 'Back to sign in',
  'link.continueToSignIn': 'Continue to sign in',
  'link.tryAgain': 'Try again',
  'link.requestNewResetLink': 'Request a new link',
  'verification.succeeded.title': 'Email verified',
  'verification.succeeded.heading': 'Your email address is verified',
  'verification.succeeded.next':
    'Return to the application you were signing in to and sign in again.',
  'verification.failed.title': "Can't verify this link",
  'verification.failed.heading': "This link can't be used",
  'verification.failed.reason':
    'It may have already been used, expired, or no longer matches your email address. Request a new verification email and try again.',
  'registration.title': 'Create account',
  'registration.username': 'Username',
  'registration.email': 'Email',
  'registration.password': 'Password',
  'registration.submit': 'Create account',
  'registration.failed.title': "Can't create this account",
  'registration.refusal.usernameRequired': 'Enter a username.',
  'registration.refusal.emailRequired': 'Enter an email address.',
  'registration.refusal.passwordRequired': 'Enter a password.',
  'registration.refusal.emailTaken': 'That email address is already registered.',
  'registration.refusal.usernameTaken': 'That username is already taken.',
  'registration.refusal.invalidEmail': 'That is not an address the email claim may carry.',
  'registration.refusal.invalidUsername':
    'That username contains a character that changes the direction of text, which is not allowed.',
  'registration.refusal.unavailable': 'Registration is temporarily unavailable. Try again later.',
  'registration.succeeded.title': 'Account created',
  'registration.succeeded.verify':
    'Check your email for a link to verify your address before you can sign in.',
  'registration.succeeded.signIn': 'You can now sign in.',
  'password.rule.minLength':
    'Password must be at least {min, number, ::group-off} characters long.',
  'password.rule.maxLength': 'Password must be at most {max, number, ::group-off} characters long.',
  'password.rule.requireDigit': 'Password must contain a digit.',
  'password.rule.requireUppercase': 'Password must contain an uppercase letter.',
  'password.rule.requireLowercase': 'Password must contain a lowercase letter.',
  'password.rule.requireSpecial': 'Password must contain a special character.',
  'password.rule.notUsername': 'Password must not contain the username.',
  'password.rule.notEmail': 'Password must not contain the email address.',
  'password.rule.notReused': 'Password must not be one you have used before.',
  'reset.request.title': 'Forgot your password?',
  'reset.request.email': 'Email',
  'reset.request.submit': 'Send reset link',
  'reset.requested.title': 'Check your email',
  'reset.requested.next':
    "If that address has an account, we've sent a link to reset its password.",
  'reset.requestFailed.title': "Can't send a reset link",
  'reset.requestFailed.emailRequired': 'Email is required.',
  'reset.requestFailed.unavailable': 'Password reset is temporarily unavailable. Try again later.',
  'reset.form.title': 'Choose a new password',
  'reset.form.newPassword': 'New password',
  'reset.form.submit': 'Reset password',
  'reset.succeeded.title': 'Password reset',
  'reset.succeeded.heading': 'Your password has been reset',
  'reset.succeeded.next':
    'Return to the application you were signing in to and sign in with your new password.',
  'reset.succeeded.nextWithLink': 'Sign in with your new password.',
  'reset.linkFailed.title': "Can't use this link",
  'reset.linkFailed.heading': "This link can't be used",
  'reset.linkFailed.reason':
    'It may have already been used or expired. Request a new one and try again.',
  'reset.required.reason': 'A new password is required.',
  'requiredActions.title': 'Update your account',
  'requiredActions.intro': 'Your administrator asks you to:',
  'requiredActions.newPassword': 'New password',
  'requiredActions.continue': 'Continue',
  'requiredActions.action.updatePassword': 'Choose a new password',
  'requiredActions.action.configureTotp': 'Set up an authenticator app',
  'requiredActions.action.configurePasskey': 'Register a passkey',
  'requiredActions.action.generateRecoveryCodes': 'Save a set of recovery codes',
  'requiredActions.succeeded.title': 'Account updated',
  'requiredActions.succeeded.heading': 'Your account is updated',
  'requiredActions.succeeded.close':
    'Return to the application you were signing in to and sign in again.',
  'requiredActions.succeeded.finish': 'Sign in to the application to finish:',
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
