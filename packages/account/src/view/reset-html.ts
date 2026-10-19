import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { sendVerificationHtml } from '#/view/verification-html';
import { escapeHtml, intro, page } from '#/view/document';
import { t, tHtml } from '#/view/messages';
import { ruleListHtml, type PasswordViolation } from '#/view/password-rules';

export { sendVerificationHtml as sendResetHtml };

export type ResetRequestRefusal = 'email_required' | 'unavailable';

export function renderResetRequestForm(tenant: string, locale: PageLocale): RenderedPage {
  const action = `/tenants/${escapeHtml(tenant)}/login-actions/reset-password`;
  return page(
    t(locale, 'reset.request.title'),
    `${intro(tHtml(locale, 'reset.request.title'), tenant)}
<form method="post" action="${action}">
  <label>${tHtml(locale, 'reset.request.email')} <input type="email" name="email" autocomplete="email"></label>
  <button type="submit">${tHtml(locale, 'reset.request.submit')}</button>
</form>`,
    null,
    [],
    locale,
  );
}

// The whole point: this text is identical whether or not the address
// exists, and the route must reach it either way — see
// #/usecase/reset-password.ts's requestPasswordReset.
export function renderResetRequestedPage(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'reset.requested.title'),
    `<h1>${tHtml(locale, 'reset.requested.title')}</h1>
<p>${tHtml(locale, 'reset.requested.next')}</p>`,
    null,
    [],
    locale,
  );
}

export function renderResetRequestFailedPage(
  refusal: ResetRequestRefusal,
  locale: PageLocale,
): RenderedPage {
  const reason = tHtml(
    locale,
    refusal === 'email_required'
      ? 'reset.requestFailed.emailRequired'
      : 'reset.requestFailed.unavailable',
  );
  return page(
    t(locale, 'reset.requestFailed.title'),
    `<h1>${tHtml(locale, 'reset.requestFailed.title')}</h1>
<p>${reason}</p>`,
    null,
    [],
    locale,
  );
}

export function renderResetPasswordForm(
  tenant: string,
  key: string,
  locale: PageLocale,
): RenderedPage {
  const action = `/tenants/${escapeHtml(tenant)}/login-actions/action-token`;
  return page(
    t(locale, 'reset.form.title'),
    `${intro(tHtml(locale, 'reset.form.title'), tenant)}
<form method="post" action="${action}">
  <input type="hidden" name="key" value="${escapeHtml(key)}">
  <label>${tHtml(locale, 'reset.form.newPassword')} <input type="password" name="password" autocomplete="new-password"></label>
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

export function renderResetLinkFailedPage(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'reset.linkFailed.title'),
    `<h1>${tHtml(locale, 'reset.linkFailed.heading')}</h1>
<p>${tHtml(locale, 'reset.linkFailed.reason')}</p>`,
    null,
    [],
    locale,
  );
}

// Distinct from renderResetLinkFailedPage: the link itself is still good,
// so a redeemer must be sent back to the same form rather than told to
// request a new one. Every reason is listed, not just the first.
export function renderResetPasswordWeakPage(
  violations: readonly PasswordViolation[],
  locale: PageLocale,
): RenderedPage {
  return page(
    t(locale, 'reset.cannotReset.title'),
    `<h1>${tHtml(locale, 'reset.cannotReset.title')}</h1>
${ruleListHtml(violations, locale)}`,
    null,
    [],
    locale,
  );
}

// Distinct from renderResetLinkFailedPage: reached only when the key is
// present and unexamined, so the link itself may be perfectly good — the
// submission was just missing the one field that matters.
export function renderResetPasswordRequiredPage(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'reset.cannotReset.title'),
    `<h1>${tHtml(locale, 'reset.cannotReset.title')}</h1>
<p>${tHtml(locale, 'reset.required.reason')}</p>`,
    null,
    [],
    locale,
  );
}
