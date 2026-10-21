import { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify';
import { wantsHtmlPage, isApiPath } from '#/service/page-negotiation';
import { sendHtml } from '#/view/html-response';
import { requestLocale } from '#/view/routes/continuation';
import { renderNotFoundPage, type NotFoundLinks } from '#/view/not-found-html';
import { renderServerErrorPage } from '#/view/server-error-html';

export interface UnroutedDeps {
  readonly links: NotFoundLinks;
  readonly pageLocales?: readonly string[] | undefined;
}

// A request id the client chose arrives through `x-request-id`, so only one
// that is safe to print is shown; the response header carries it either way.
const SHOWABLE_ID = /^[A-Za-z0-9_-]{1,64}$/u;

// Both answers depend on Accept, the language and the theme cookie, so a
// cache that stored either is told which request headers chose it.
const VARY = 'Accept, Accept-Language, Cookie';

function negotiated(reply: FastifyReply, request: FastifyRequest): FastifyReply {
  if (isApiPath(request.url)) return reply;
  return reply.header('vary', VARY).header('cache-control', 'no-store');
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  body: { type: string; title: string; status: number; detail?: string },
): FastifyReply {
  return negotiated(reply, request)
    .code(body.status)
    .header('content-type', 'application/problem+json')
    .send({ ...body, instance: request.id });
}

// Every path no route claims. An admin or protocol client gets RFC 9457's
// document, as does anything that is not a browser asking for a page.
export function answerNotFound(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: UnroutedDeps,
): FastifyReply {
  if (wantsHtmlPage(request.method, request.url, request.headers.accept)) {
    return sendHtml(
      reply.header('vary', VARY),
      404,
      renderNotFoundPage(deps.links, requestLocale(reply, deps)),
    );
  }
  return sendProblem(reply, request, {
    type: 'about:blank#not-found',
    title: 'Not Found',
    status: 404,
    detail: 'No resource at this path',
  });
}

// The root error handler. A server error is a fixed document: the driver's
// message carries the query and its parameters, so it is logged by kind only
// and never sent. A client error keeps the framework's own answer.
export function answerServerError(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
  deps: UnroutedDeps,
): FastifyReply {
  const status = error.statusCode ?? 500;
  if (status < 500) return reply.send(error);
  request.log.error({ err: { type: error.name, code: error.code } }, 'request failed');
  if (wantsHtmlPage(request.method, request.url, request.headers.accept)) {
    const id = SHOWABLE_ID.test(request.id) ? request.id : null;
    return sendHtml(
      reply.header('vary', VARY),
      500,
      renderServerErrorPage(id, requestLocale(reply, deps)),
    );
  }
  return sendProblem(reply, request, {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
  });
}
