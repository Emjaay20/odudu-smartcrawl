import { type FastifyReply } from 'fastify';
import { renderAuthorizeErrorPage } from '#/view/authorize-html';
import { sendHtml } from '#/view/html-response';
import { t, type MessageId } from '#/view/messages';
import { requestLocale } from '#/view/routes/continuation';

// The error page for a request that is no part of a parked sign-in: the
// sentence is the catalogue's, in the language the browser asked for.
export function sendRequestError(
  reply: FastifyReply,
  deps: { pageLocales?: readonly string[] | undefined },
  status: number,
  messageId: MessageId,
): FastifyReply {
  const locale = requestLocale(reply, deps);
  return sendHtml(
    reply,
    status,
    renderAuthorizeErrorPage('invalid_request', t(locale, messageId), undefined, locale),
  );
}
