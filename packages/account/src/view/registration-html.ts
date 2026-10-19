import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { escapeHtml, page } from '#/view/document';
import { t, tHtml, type MessageId } from '#/view/messages';
import { ruleListHtml, type PasswordViolation } from '#/view/password-rules';

export type RegistrationRefusal =
  'fields_required' | 'email_taken' | 'username_taken' | 'invalid_email' | 'unavailable';

// Why the submission was refused: one reason the person can act on, or every
// rule the password broke, listed at once so a policy with four rules does
// not take four submissions to satisfy.
export type RegistrationFailure =
  { readonly refusal: RegistrationRefusal } | { readonly violations: readonly PasswordViolation[] };

const REFUSAL_MESSAGE: Readonly<Record<RegistrationRefusal, MessageId>> = {
  fields_required: 'registration.refusal.fieldsRequired',
  email_taken: 'registration.refusal.emailTaken',
  username_taken: 'registration.refusal.usernameTaken',
  invalid_email: 'registration.refusal.invalidEmail',
  unavailable: 'registration.refusal.unavailable',
};

export function renderRegistrationForm(tenant: string, locale: PageLocale): RenderedPage {
  const action = `/tenants/${escapeHtml(tenant)}/login-actions/registration`;
  return page(
    t(locale, 'registration.title'),
    `<form method="post" action="${action}">
  <label>${tHtml(locale, 'registration.username')} <input type="text" name="username" autocomplete="username"></label>
  <label>${tHtml(locale, 'registration.email')} <input type="email" name="email" autocomplete="email"></label>
  <label>${tHtml(locale, 'registration.password')} <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">${tHtml(locale, 'registration.submit')}</button>
</form>`,
    null,
    [],
    locale,
  );
}

export function renderRegistrationFailedPage(
  failure: RegistrationFailure,
  locale: PageLocale,
): RenderedPage {
  const reasons =
    'refusal' in failure
      ? `<ul>\n<li>${tHtml(locale, REFUSAL_MESSAGE[failure.refusal])}</li>\n</ul>`
      : ruleListHtml(failure.violations, locale);
  return page(
    t(locale, 'registration.failed.title'),
    `<h1>${tHtml(locale, 'registration.failed.title')}</h1>
${reasons}`,
    null,
    [],
    locale,
  );
}

// The word "verify" only appears here when the tenant actually requires it —
// the whole point is that an unverified account cannot sign in yet, so the
// page must not claim otherwise.
export function renderRegistrationSucceededPage(
  verifyEmailRequired: boolean,
  locale: PageLocale,
): RenderedPage {
  const next = tHtml(
    locale,
    verifyEmailRequired ? 'registration.succeeded.verify' : 'registration.succeeded.signIn',
  );
  return page(
    t(locale, 'registration.succeeded.title'),
    `<h1>${tHtml(locale, 'registration.succeeded.title')}</h1>
<p>${next}</p>`,
    null,
    [],
    locale,
  );
}
