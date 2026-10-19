import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { escapeHtml, page } from '#/view/document';

// The page a login parks on while `update-password` is owed, and the page a
// refused candidate comes back to. `violations` is every rule the tenant's
// policy reported, listed at once for the reason evaluatePassword collects
// them all rather than stopping at the first. The hidden auth_session_id is
// this page's own CSRF defence and what resumes the parked login, exactly
// as on the enrolment pages beside it.
export function renderUpdatePasswordPage(
  tenant: string,
  authSessionId: string,
  violations: readonly string[] = [],
  locale: PageLocale,
): RenderedPage {
  const target = `/tenants/${escapeHtml(tenant)}/login-actions/required-action?action=update-password`;
  const listed =
    violations.length === 0
      ? ''
      : `<ul>\n${violations.map((message) => `<li>${escapeHtml(message)}</li>`).join('\n')}\n</ul>\n`;
  const title = 'Change your password';
  const body = `<h1>Change your password</h1>
<p>This account needs a new password before you can continue.</p>
${listed}<form method="post" action="${target}">
  <input type="hidden" name="auth_session_id" value="${escapeHtml(authSessionId)}">
  <label>New password <input type="password" name="password" autocomplete="new-password"></label>
  <button type="submit">Update password</button>
</form>`;
  // No script: nothing on this page fetches anything, so the base
  // content-security policy describes it exactly.
  return page(title, body, null, [], locale);
}
