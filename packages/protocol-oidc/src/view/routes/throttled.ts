import { type FastifyReply } from 'fastify';
import { sendHtml } from '#/view/html-response';
import { renderThrottledPage } from '#/view/throttled-html';

// The answer for a submission to a page route that a request budget refused.
// Retry-After is the budget's own figure, and the page reads the same one.
export function sendThrottledPage(reply: FastifyReply, retryAfterSeconds: number): FastifyReply {
  return sendHtml(
    reply.header('retry-after', String(retryAfterSeconds)),
    429,
    renderThrottledPage(retryAfterSeconds),
  );
}
