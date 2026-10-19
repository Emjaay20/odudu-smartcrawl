import { type PageLocale, pageHeaders, type RenderedPage } from '@odudu/kernel';
import { type FastifyReply } from 'fastify';
import { page } from '#/view/document';
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

export function renderVerificationSucceededPage(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'verification.succeeded.title'),
    `<h1>${tHtml(locale, 'verification.succeeded.heading')}</h1>
<p>${tHtml(locale, 'verification.succeeded.next')}</p>`,
    null,
    [],
    locale,
  );
}

export function renderVerificationFailedPage(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'verification.failed.title'),
    `<h1>${tHtml(locale, 'verification.failed.heading')}</h1>
<p>${tHtml(locale, 'verification.failed.reason')}</p>`,
    null,
    [],
    locale,
  );
}
