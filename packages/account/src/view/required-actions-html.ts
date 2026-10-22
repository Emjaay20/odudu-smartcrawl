import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { type LinkedRequiredAction } from '#/usecase/action-token';
import { escapeHtml, intro, page } from '#/view/document';
import { invalidAttributes, problemSummary } from '#/view/form-error';
import { bdi, t, tHtml, type MessageId } from '#/view/messages';
import { passwordProblems, type PasswordFailure } from '#/view/password-rules';

const ACTION_MESSAGE: Readonly<Record<LinkedRequiredAction, MessageId>> = {
  'update-password': 'requiredActions.action.updatePassword',
  'configure-totp': 'requiredActions.action.configureTotp',
  'configure-passkey': 'requiredActions.action.configurePasskey',
  'generate-recovery-codes': 'requiredActions.action.generateRecoveryCodes',
};

// An action this build has no wording for shows its code, isolated, rather
// than nothing.
function listHtml(actions: readonly LinkedRequiredAction[], locale: PageLocale): string {
  const items = actions.map(
    (action) =>
      `<li>${Object.hasOwn(ACTION_MESSAGE, action) ? tHtml(locale, ACTION_MESSAGE[action]) : bdi(action)}</li>`,
  );
  return `<ul>\n${items.join('\n')}\n</ul>`;
}

// An actions link's own page, shown before anything is consumed: a link
// scanner's GET must not spend it. A password field only where the link
// asks for one, and the page the form comes back to when the password was
// refused, with the reasons in place.
export function renderRequiredActionsForm(
  tenant: string,
  key: string,
  actions: readonly LinkedRequiredAction[],
  setsPassword: boolean,
  failure: PasswordFailure | undefined,
  locale: PageLocale,
): RenderedPage {
  const action = `/tenants/${escapeHtml(tenant)}/login-actions/action-token`;
  const problems = passwordProblems(failure, locale);
  const attributes = `${invalidAttributes(problems, 'password')}${problems.length === 0 ? '' : ' autofocus'}`;
  const password = setsPassword
    ? `\n  <label>${tHtml(locale, 'requiredActions.newPassword')} <input type="password" name="password" autocomplete="new-password"${attributes}></label>`
    : '';
  return page(
    t(locale, 'requiredActions.title'),
    `${intro(tHtml(locale, 'requiredActions.title'), tenant)}
<p>${tHtml(locale, 'requiredActions.intro')}</p>
${listHtml(actions, locale)}
${problemSummary(problems)}<form method="post" action="${action}">
  <input type="hidden" name="key" value="${escapeHtml(key)}">${password}
  <button type="submit">${tHtml(locale, 'requiredActions.continue')}</button>
</form>`,
    null,
    [],
    locale,
  );
}

export function renderRequiredActionsSucceededPage(
  remaining: readonly LinkedRequiredAction[],
  locale: PageLocale,
): RenderedPage {
  const rest =
    remaining.length === 0
      ? `<p>${tHtml(locale, 'requiredActions.succeeded.close')}</p>`
      : `<p>${tHtml(locale, 'requiredActions.succeeded.finish')}</p>
${listHtml(remaining, locale)}`;
  return page(
    t(locale, 'requiredActions.succeeded.title'),
    `<h1>${tHtml(locale, 'requiredActions.succeeded.heading')}</h1>
${rest}`,
    null,
    [],
    locale,
  );
}
