import { previewThemeQuerySchema } from '@odudu/contracts/admin';
import { type Database } from '@odudu/db';
import { previewHeaders } from '@odudu/kernel';
import { issuerBaseFor } from '@odudu/protocol-oidc';
import { previewTheme, type ThemePreviewDeps } from '#/usecase/theme-preview';
import { problem, sendProblem } from '#/view/problem';
import { adminTx } from '#/view/routes/admin-tx';
import { type AdminRouteHandler } from '#/view/routes/router';

export interface ThemePreviewRouteDeps extends ThemePreviewDeps {
  readonly database: Database;
}

// One handler for a scope, like the theme routes beside it: the tenant's draft
// or a client's, which differ only in whose row it is.
export function themePreviewHandler(
  deps: ThemePreviewRouteDeps,
  scope: 'tenant' | 'client',
): AdminRouteHandler {
  return async (request, reply, _principal, tenantId) => {
    const tenantName = request.params.tenant;
    const clientRowId = scope === 'client' ? request.params.id : undefined;
    if (tenantName === undefined || (scope === 'client' && clientRowId === undefined)) {
      throw new Error('protocol-admin: a theme preview route received no :tenant or :id');
    }
    const query = previewThemeQuerySchema.parse(request.query);
    const origin = new URL(issuerBaseFor(request)).origin;
    const outcome = await adminTx(deps.database, request, tenantId, (tx) =>
      previewTheme(
        tx,
        deps,
        { tenantId, tenantName, clientRowId: clientRowId ?? null },
        { query, origin },
      ),
    );
    if (outcome.kind === 'not_found') {
      return sendProblem(reply, request, problem(404, 'about:blank', 'Not Found'));
    }
    if (outcome.kind === 'too_large') {
      return sendProblem(
        reply,
        request,
        problem(
          422,
          'about:blank#theme-preview-too-large',
          'Unprocessable Content',
          `the draft's stylesheet and images come to ${String(outcome.bytes)} bytes once inlined, over the 1 MiB a preview carries`,
        ),
      );
    }
    reply.code(200).header('content-type', 'text/html; charset=utf-8');
    for (const [name, value] of previewHeaders(outcome.inlined)) reply.header(name, value);
    if (outcome.inlined.scriptOmitted) reply.header('x-odudu-preview-script', 'omitted');
    if (outcome.fallbacks.length > 0) {
      reply.header('x-odudu-preview-fallback', outcome.fallbacks.join(','));
    }
    return reply.send(outcome.inlined.html);
  };
}
