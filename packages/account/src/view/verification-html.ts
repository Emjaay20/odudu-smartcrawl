import { type PageLocale, pageHeaders, type RenderedPage } from '@odudu/kernel';
import { type FastifyReply } from 'fastify';
import { escapeHtml, page } from '#/view/document';
import { links } from '#/view/links';
import { t, tHtml } from '#/view/messages';

export function sendVerificationHtml(
  reply: FastifyReply,
  status: number,
  rendered: RenderedPage,
): FastifyReply {
  const withHeaders = pageHeaders(rendered).reduce(
    (r, [name, value]) => r.header(name, value),
    reply.code(status).type('text/html'),
  );
  return withHeaders.send(rendered.html);
}

// A way back to sign-in, when the mailed link carried one.
function backToSignIn(signInPath: string | null, locale: PageLocale): string {
  return signInPath === null
    ? ''
    : links([{ href: signInPath, text: tHtml(locale, 'link.backToSignIn') }]);
}

// Verifying needs no session: the token is single-use and works in any browser.
// With the sign-in the link was mailed for, the page leads straight back to it;
// without one it says what to do, and implies no sign-in is waiting.
export function renderVerificationSucceededPage(
  signInPath: string | null,
  locale: PageLocale,
): RenderedPage {
  const next =
    signInPath === null
      ? `\n<p>${tHtml(locale, 'verification.succeeded.next')}</p>`
      : links([{ href: signInPath, text: tHtml(locale, 'link.continueToSignIn') }]);
  return page(
    t(locale, 'verification.succeeded.title'),
    `<h1>${tHtml(locale, 'verification.succeeded.heading')}</h1>${next}`,
    null,
    [],
    locale,
  );
}

export function renderVerificationFailedPage(
  signInPath: string | null,
  locale: PageLocale,
): RenderedPage {
  return page(
    t(locale, 'verification.failed.title'),
    `<h1>${tHtml(locale, 'verification.failed.heading')}</h1>
<p>${tHtml(locale, 'verification.failed.reason')}</p>${backToSignIn(signInPath, locale)}`,
    null,
    [],
    locale,
  );
}

export type ConfirmedLink = 'verify' | 'register';

// What a mailed link shows on a visit. Opening it changes nothing: a mail
// scanner or a link preview reads the page and the key is still good. One
// button posts the key back, and that is what verifies or creates.
export function renderLinkConfirmPage(
  tenant: string,
  key: string,
  kind: ConfirmedLink,
  locale: PageLocale,
): RenderedPage {
  const action = `/tenants/${escapeHtml(encodeURIComponent(tenant))}/login-actions/action-token`;
  return page(
    t(locale, `confirm.${kind}.title`),
    `<h1>${tHtml(locale, `confirm.${kind}.title`)}</h1>
<p>${tHtml(locale, `confirm.${kind}.next`)}</p>
<form method="post" action="${action}">
  <input type="hidden" name="key" value="${escapeHtml(key)}">
  <button type="submit">${tHtml(locale, `confirm.${kind}.button`)}</button>
</form>`,
    null,
    [],
    locale,
  );
}
