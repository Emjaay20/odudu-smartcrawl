import { MAX_PASSWORD_LENGTH, type PageLocale, type RenderedPage } from '@odudu/kernel';
import { type PasswordViolation } from '#/schema/password-violation';
import { escapeHtml, intro, page } from '#/view/document';
import { invalidAttributes, problemSummary } from '#/view/form-error';
import { bdi, t, tHtml, type MessageId } from '#/view/messages';

// Every rule a violation can name, by the code the domain reports it under.
const RULE_MESSAGE: Readonly<Record<string, MessageId>> = {
  'min-length': 'updatePassword.rule.minLength',
  'max-length': 'updatePassword.rule.maxLength',
  'require-digit': 'updatePassword.rule.requireDigit',
  'require-uppercase': 'updatePassword.rule.requireUppercase',
  'require-lowercase': 'updatePassword.rule.requireLowercase',
  'require-special': 'updatePassword.rule.requireSpecial',
  'not-username': 'updatePassword.rule.notUsername',
  'not-email': 'updatePassword.rule.notEmail',
  'not-reused': 'updatePassword.rule.notReused',
  superseded: 'updatePassword.rule.superseded',
};

// The domain's sentences are developer-facing English, so a rule this build
// has no entry for shows that sentence, isolated, rather than nothing.
function ruleHtml(violation: PasswordViolation, locale: PageLocale): string {
  const id = Object.hasOwn(RULE_MESSAGE, violation.rule) ? RULE_MESSAGE[violation.rule] : undefined;
  // A minimum the page was not told is not one to state.
  if (id === undefined || (violation.rule === 'min-length' && violation.minLength === undefined)) {
    return bdi(violation.message);
  }
  return tHtml(locale, id, { min: violation.minLength ?? 0, max: MAX_PASSWORD_LENGTH });
}

// The page a login parks on while `update-password` is owed, and the page a
// refused candidate comes back to. `violations` is every rule the tenant's
// policy reported, listed at once for the reason evaluatePassword collects
// them all rather than stopping at the first. The hidden auth_session_id is
// this page's own CSRF defence and what resumes the parked login, exactly
// as on the enrolment pages beside it.
export function renderUpdatePasswordPage(
  tenant: string,
  authSessionId: string,
  violations: readonly PasswordViolation[] = [],
  locale: PageLocale,
): RenderedPage {
  const target = `/tenants/${escapeHtml(encodeURIComponent(tenant))}/login-actions/required-action?action=update-password`;
  const problems = violations.map((violation) => ({
    fields: ['password'],
    html: ruleHtml(violation, locale),
  }));
  const focus = problems.length === 0 ? '' : ' autofocus';
  const title = t(locale, 'updatePassword.title');
  const body = `${intro(tHtml(locale, 'updatePassword.title'), tenant)}
<p>${tHtml(locale, 'updatePassword.intro')}</p>
${problemSummary(problems)}<form method="post" action="${target}">
  <input type="hidden" name="auth_session_id" value="${escapeHtml(authSessionId)}">
  <label>${tHtml(locale, 'updatePassword.newPassword')} <input type="password" name="password" autocomplete="new-password"${invalidAttributes(problems, 'password')}${focus}></label>
  <button type="submit">${tHtml(locale, 'updatePassword.submit')}</button>
</form>`;
  // No script: nothing on this page fetches anything, so the base
  // content-security policy describes it exactly.
  return page(title, body, null, [], locale);
}
