import { type PageLocale, pageHeaders, type RenderedPage } from '@odudu/kernel';
import { type FastifyReply } from 'fastify';
import { page } from '#/view/document';
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
