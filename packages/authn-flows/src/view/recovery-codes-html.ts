import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { type EnrolmentRefusal } from '#/schema/enrolment-refusal';
import { escapeHtml, page } from '#/view/document';
import { t, tHtml, token } from '#/view/messages';
import { refusalHtml } from '#/view/refusal';

// What the page has to show: the codes in plaintext, and whether they
// displace a set the subject was issued earlier — a page that silently
// retired ten codes somebody still has on paper would be lying by omission.
export interface RecoveryCodesOffer {
  codes: readonly string[];
  replaced: boolean;
}

// The one render of these codes there will ever be. They are hashed in the
// database exactly as a password is, so no later page — and no
// administrator — can show them again; the form below carries no code back,
// only the acknowledgement that the page was seen.
export function renderRecoveryCodesPage(
  tenant: string,
  authSessionId: string,
  offer: RecoveryCodesOffer,
  error: EnrolmentRefusal | undefined,
  locale: PageLocale,
): RenderedPage {
  const target = `/tenants/${escapeHtml(tenant)}/login-actions/required-action?action=generate-recovery-codes`;
  const replaced = offer.replaced ? `<p>${tHtml(locale, 'recoveryCodes.replaced')}</p>\n` : '';
  const items = offer.codes.map((code) => `  <li>${token(code)}</li>`).join('\n');
  const title = t(locale, 'recoveryCodes.title');
  const body = `<h1>${tHtml(locale, 'recoveryCodes.title')}</h1>
${refusalHtml(locale, error)}<p>${tHtml(locale, 'recoveryCodes.use')} <strong>${tHtml(locale, 'recoveryCodes.onlyTime')}</strong> ${tHtml(locale, 'recoveryCodes.keep')}</p>
${replaced}<ol>
${items}
</ol>
<form method="post" action="${target}">
  <input type="hidden" name="auth_session_id" value="${escapeHtml(authSessionId)}">
  <button type="submit">${tHtml(locale, 'recoveryCodes.acknowledge')}</button>
</form>`;
  // No script: nothing on this page talks to an authenticator or fetches
  // anything, so the base content-security policy describes it exactly.
  return page(title, body, null, [], locale);
}
