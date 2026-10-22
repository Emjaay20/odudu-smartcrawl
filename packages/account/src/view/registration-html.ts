import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { escapeHtml, intro, page } from '#/view/document';
import { links, type WayOn } from '#/view/links';
import {
  echoedValue,
  firstInvalidField,
  invalidAttributes,
  problemSummary,
  type Problem,
} from '#/view/form-error';
import { returnToField } from '#/view/return-to';
import { t, tHtml, type MessageId } from '#/view/messages';
import { ruleHtml, type PasswordViolation } from '#/view/password-rules';

export type RegistrationField = 'username' | 'email' | 'password';

export type RegistrationRefusal =
  'email_taken' | 'username_taken' | 'invalid_email' | 'invalid_username';

// Why the submission was refused, in terms of the form: the fields left
// empty, one reason the person can act on, or every rule the password broke,
// listed at once so a policy with four rules does not take four submissions
// to satisfy.
export type RegistrationFailure =
  | { readonly missing: readonly RegistrationField[] }
  | { readonly refusal: RegistrationRefusal }
  | { readonly violations: readonly PasswordViolation[] };

const REFUSAL_FIELD: Readonly<Record<RegistrationRefusal, RegistrationField>> = {
  email_taken: 'email',
  username_taken: 'username',
  invalid_email: 'email',
  invalid_username: 'username',
};

const REFUSAL_MESSAGE: Readonly<Record<RegistrationRefusal, MessageId>> = {
  email_taken: 'registration.refusal.emailTaken',
  username_taken: 'registration.refusal.usernameTaken',
  invalid_email: 'registration.refusal.invalidEmail',
  invalid_username: 'registration.refusal.invalidUsername',
};

const REQUIRED_MESSAGE: Readonly<Record<RegistrationField, MessageId>> = {
  username: 'registration.refusal.usernameRequired',
  email: 'registration.refusal.emailRequired',
  password: 'registration.refusal.passwordRequired',
};

const FIELD_ORDER: readonly RegistrationField[] = ['username', 'email', 'password'];

function problemsOf(failure: RegistrationFailure | undefined, locale: PageLocale): Problem[] {
  if (failure === undefined) return [];
  if ('missing' in failure) {
    return FIELD_ORDER.filter((field) => failure.missing.includes(field)).map((field) => ({
      fields: [field],
      html: tHtml(locale, REQUIRED_MESSAGE[field]),
    }));
  }
  if ('refusal' in failure) {
    return [
      {
        fields: [REFUSAL_FIELD[failure.refusal]],
        html: tHtml(locale, REFUSAL_MESSAGE[failure.refusal]),
      },
    ];
  }
  return failure.violations.map((violation) => ({
    fields: ['password'],
    html: ruleHtml(violation, locale),
  }));
}

// What the form is rendered with beyond its tenant. Only the username and the
// email are ever given back: the password is never put in a field again.
export interface RegistrationForm {
  readonly signInPath?: string | null;
  readonly failure?: RegistrationFailure;
  readonly username?: string;
  readonly email?: string;
}

function backToSignIn(signInPath: string | null | undefined, locale: PageLocale): WayOn | null {
  return signInPath === null || signInPath === undefined
    ? null
    : { href: signInPath, text: tHtml(locale, 'link.backToSignIn') };
}

export function renderRegistrationForm(
  tenant: string,
  form: RegistrationForm,
  locale: PageLocale,
): RenderedPage {
  const action = `/tenants/${escapeHtml(encodeURIComponent(tenant))}/login-actions/registration`;
  const problems = problemsOf(form.failure, locale);
  const focus = firstInvalidField(problems, FIELD_ORDER);
  const attributes = (field: RegistrationField): string =>
    `${invalidAttributes(problems, field)}${focus === field ? ' autofocus' : ''}`;
  const value = (text: string | undefined): string => {
    const echoed = text === undefined ? undefined : echoedValue(text);
    return echoed === undefined ? '' : ` value="${escapeHtml(echoed)}"`;
  };
  return page(
    t(locale, 'registration.title'),
    `${intro(tHtml(locale, 'registration.title'), tenant)}
${problemSummary(problems)}<form method="post" action="${action}">${returnToField(form.signInPath)}
  <label>${tHtml(locale, 'registration.username')} <input type="text" name="username" autocomplete="username"${value(form.username)}${attributes('username')}></label>
  <label>${tHtml(locale, 'registration.email')} <input type="email" name="email" autocomplete="email"${value(form.email)}${attributes('email')}></label>
  <label>${tHtml(locale, 'registration.password')} <input type="password" name="password" autocomplete="new-password"${attributes('password')}></label>
  <button type="submit">${tHtml(locale, 'registration.submit')}</button>
</form>${links([backToSignIn(form.signInPath, locale)])}`,
    null,
    [],
    locale,
  );
}

// The one refusal that is not about a field: registration cannot run at all.
// It stays a page, with the way to try again and the way back.
export function renderRegistrationFailedPage(
  tenant: string,
  signInPath: string | null,
  locale: PageLocale,
): RenderedPage {
  const retry = `/tenants/${encodeURIComponent(tenant)}/login-actions/registration`;
  return page(
    t(locale, 'registration.failed.title'),
    `<h1>${tHtml(locale, 'registration.failed.title')}</h1>
<p>${tHtml(locale, 'registration.refusal.unavailable')}</p>${links([
      {
        href: signInPath === null ? retry : retryWith(retry, signInPath),
        text: tHtml(locale, 'link.tryAgain'),
      },
      backToSignIn(signInPath, locale),
    ])}`,
    null,
    [],
    locale,
  );
}

function retryWith(path: string, signInPath: string): string {
  return `${path}?${new URLSearchParams({ return_to: signInPath }).toString()}`;
}

// The word "verify" only appears here when the tenant actually requires it —
// the whole point is that an unverified account cannot sign in yet, so the
// page must not claim otherwise.
export function renderRegistrationSucceededPage(
  verifyEmailRequired: boolean,
  signInPath: string | null,
  locale: PageLocale,
): RenderedPage {
  const next = tHtml(
    locale,
    verifyEmailRequired ? 'registration.succeeded.verify' : 'registration.succeeded.signIn',
  );
  return page(
    t(locale, 'registration.succeeded.title'),
    `<h1>${tHtml(locale, 'registration.succeeded.title')}</h1>
<p>${next}</p>${links([backToSignIn(signInPath, locale)])}`,
    null,
    [],
    locale,
  );
}
