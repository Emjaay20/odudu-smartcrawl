import { type FastifyReply } from 'fastify';
import { restartAuthorizeLocation } from '#/service/restart-request';
import { renderAuthorizeErrorPage } from '#/view/authorize-html';
import { sendHtml } from '#/view/html-response';
import { type ContinuationDeps } from '#/view/routes/continuation';

// The one answer for a submission whose authentication session is no longer
// usable. The row may still exist — it lives until the reaper deletes it —
// and then it is read only to rebuild a link to /authorize, which validates
// the request again from scratch; it authenticates nothing. With no row,
// or one that cannot be rebuilt faithfully, the page offers no link.
export async function sendSignInExpired(
  reply: FastifyReply,
  deps: ContinuationDeps,
  tenantName: string,
  authSessionId: string | undefined,
): Promise<FastifyReply> {
  const tenant = authSessionId === undefined ? null : await deps.findTenant(tenantName);
  const pending =
    tenant === null || authSessionId === undefined
      ? null
      : await deps.recoverPendingRequest(tenant.id, authSessionId);
  const restart = pending === null ? undefined : restartAuthorizeLocation(tenantName, pending);
  return sendHtml(
    reply,
    400,
    renderAuthorizeErrorPage(
      'invalid_request',
      'This sign-in attempt is no longer valid. Go back and start again.',
      restart ?? undefined,
    ),
  );
}
