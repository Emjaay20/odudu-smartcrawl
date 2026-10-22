import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { sendVerificationHtml } from '#/view/verification-html';
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
import { t, tHtml } from '#/view/messages';
import { passwordProblems, type PasswordFailure } from '#/view/password-rules';

export { sendVerificationHtml as sendResetHtml };

function backToSignIn(signInPath: string | null | undefined, locale: PageLocale): WayOn | null {
  return signInPath === null || signInPath === undefined
    ? null
    : { href: signInPath, text: tHtml(locale, 'link.backToSignIn') };
}

// The form that asks for an address. `emailRequired` is its one refusal: the
// form comes back with the message in place and whatever was typed.
export interface ResetRequestForm {
  readonly signInPath?: string | null;
  readonly emailRequired?: boolean;
  readonly email?: string;
}

export function renderResetRequestForm(
  tenant: string,
  form: ResetRequestForm,
  locale: PageLocale,
): RenderedPage {
  const action = `/tenants/${escapeHtml(encodeURIComponent(tenant))}/login-actions/reset-password`;
  const problems: Problem[] =
    form.emailRequired === true
      ? [{ fields: ['email'], html: tHtml(locale, 'reset.requestFailed.emailRequired') }]
      : [];
  const attributes = `${invalidAttributes(problems, 'email')}${
    firstInvalidField(problems, ['email']) === null ? '' : ' autofocus'
  }`;
  const echoed = form.email === undefined ? undefined : echoedValue(form.email);
  const value = echoed === undefined ? '' : ` value="${escapeHtml(echoed)}"`;
  return page(
    t(locale, 'reset.request.title'),
    `${intro(tHtml(locale, 'reset.request.title'), tenant)}
${problemSummary(problems)}<form method="post" action="${action}">${returnToField(form.signInPath)}
  <label>${tHtml(locale, 'reset.request.email')} <input type="email" name="email" autocomplete="email"${value}${attributes}></label>
  <button type="submit">${tHtml(locale, 'reset.request.submit')}</button>
</form>${links([backToSignIn(form.signInPath, locale)])}`,
    null,
    [],
    locale,
  );
}

// The whole point: this text is identical whether or not the address
// exists, and the route must reach it either way — see
// #/usecase/reset-password.ts's requestPasswordReset.
export function renderResetRequestedPage(
  signInPath: string | null,
  locale: PageLocale,
): RenderedPage {
  return page(
    t(locale, 'reset.requested.title'),
    `<h1>${tHtml(locale, 'reset.requested.title')}</h1>
<p>${tHtml(locale, 'reset.requested.next')}</p>${links([backToSignIn(signInPath, locale)])}`,
    null,
    [],
    locale,
  );
}

// The one refusal of a reset request that is not about the field: the server
// cannot send mail. It stays a page, with the way to try again.
export function renderResetRequestFailedPage(
  tenant: string,
  signInPath: string | null,
  locale: PageLocale,
): RenderedPage {
  const retry = `/tenants/${encodeURIComponent(tenant)}/login-actions/reset-password`;
  const href =
    signInPath === null
      ? retry
      : `${retry}?${new URLSearchParams({ return_to: signInPath }).toString()}`;
  return page(
    t(locale, 'reset.requestFailed.title'),
    `<h1>${tHtml(locale, 'reset.requestFailed.title')}</h1>
<p>${tHtml(locale, 'reset.requestFailed.unavailable')}</p>${links([
      { href, text: tHtml(locale, 'link.tryAgain') },
      backToSignIn(signInPath, locale),
    ])}`,
    null,
    [],
    locale,
  );
}

// The form a reset link opens, and the form a refused candidate comes back to:
// the key travels in a hidden field as it does on the first showing, and the
// password is never given back.
export function renderResetPasswordForm(
  tenant: string,
  key: string,
  failure: PasswordFailure | undefined,
  locale: PageLocale,
): RenderedPage {
  const action = `/tenants/${escapeHtml(encodeURIComponent(tenant))}/login-actions/action-token`;
  const problems = passwordProblems(failure, locale);
  const attributes = `${invalidAttributes(problems, 'password')}${problems.length === 0 ? '' : ' autofocus'}`;
  return page(
    t(locale, 'reset.form.title'),
    `${intro(tHtml(locale, 'reset.form.title'), tenant)}
${problemSummary(problems)}<form method="post" action="${action}">
  <input type="hidden" name="key" value="${escapeHtml(key)}">
  <label>${tHtml(locale, 'reset.form.newPassword')} <input type="password" name="password" autocomplete="new-password"${attributes}></label>
  <button type="submit">${tHtml(locale, 'reset.form.submit')}</button>
</form>`,
    null,
    [],
    locale,
  );
}

export function renderResetPasswordSucceededPage(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'reset.succeeded.title'),
    `<h1>${tHtml(locale, 'reset.succeeded.heading')}</h1>
<p>${tHtml(locale, 'reset.succeeded.next')}</p>`,
    null,
    [],
    locale,
  );
}

// A reset link that cannot be used. When the link was a reset link and the
// tenant still allows resets, the way on is a new one.
export function renderResetLinkFailedPage(
  requestNewPath: string | null,
  locale: PageLocale,
): RenderedPage {
  const next: WayOn | null =
    requestNewPath === null
      ? null
      : { href: requestNewPath, text: tHtml(locale, 'link.requestNewResetLink') };
  return page(
    t(locale, 'reset.linkFailed.title'),
    `<h1>${tHtml(locale, 'reset.linkFailed.heading')}</h1>
<p>${tHtml(locale, 'reset.linkFailed.reason')}</p>${links([next])}`,
    null,
    [],
    locale,
  );
}
