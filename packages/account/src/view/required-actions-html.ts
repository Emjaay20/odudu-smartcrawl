import { DEFAULT_PAGE_LOCALE, type PageLocale, type RenderedPage } from '@odudu/kernel';
import { escapeHtml, page } from '#/view/document';

// An actions link's own page, shown before anything is consumed: a link
// scanner's GET must not spend it. A password field only where the link
// asks for one.
export function renderRequiredActionsForm(
  tenant: string,
  key: string,
  actionLabels: readonly string[],
  setsPassword: boolean,
  locale: PageLocale = DEFAULT_PAGE_LOCALE,
): RenderedPage {
  const action = `/tenants/${escapeHtml(tenant)}/login-actions/action-token`;
  const items = actionLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join('\n');
  const password = setsPassword
    ? '\n  <label>New password <input type="password" name="password" autocomplete="new-password"></label>'
    : '';
  return page(
    'Update your account',
    `<h1>Update your account</h1>
<p>Your administrator asks you to:</p>
<ul>
${items}
</ul>
<form method="post" action="${action}">
  <input type="hidden" name="key" value="${escapeHtml(key)}">${password}
  <button type="submit">Continue</button>
</form>`,
    null,
    [],
    locale,
  );
}

export function renderRequiredActionsSucceededPage(
  remaining: readonly string[],
  locale: PageLocale = DEFAULT_PAGE_LOCALE,
): RenderedPage {
  const rest =
    remaining.length === 0
      ? '<p>You can close this page and sign in to the application.</p>'
      : `<p>Sign in to the application to finish:</p>
<ul>
${remaining.map((label) => `<li>${escapeHtml(label)}</li>`).join('\n')}
</ul>`;
  return page(
    'Account updated',
    `<h1>Your account is updated</h1>
${rest}`,
    null,
    [],
    locale,
  );
}
