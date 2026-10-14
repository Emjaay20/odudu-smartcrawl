import { listAuditResponseSchema } from '@odudu/contracts/admin';
import { listReader, segment } from '#/shared/adapter/route';
import type { Gateway, GatewayResult, RawBody } from '#/shared/transport/gateway';

// Shared by the Audit trail and every record's Activity tab, which is the
// same list narrowed to one resource.
export const readAuditPage = listReader('audit', listAuditResponseSchema);

// The events a listing's filters match, as the NDJSON the server wrote.
export function exportAuditEvents(
  gateway: Gateway,
  tenant: string,
  query: URLSearchParams,
): Promise<GatewayResult<RawBody>> {
  const t = segment(tenant);
  const search = query.toString();
  return search === ''
    ? gateway.download('GET', `admin/tenants/${t}/audit/export`)
    : gateway.download('GET', `admin/tenants/${t}/audit/export?${search}`);
}
