import {
  endTenantSessionsResponseSchema,
  listTenantSessionsResponseSchema,
  type EndTenantSessionsResponse,
} from '@odudu/contracts/admin';
import { adminCall, listReader } from '#/shared/adapter/route';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

export const readTenantSessionPage = listReader('sessions', listTenantSessionsResponseSchema);

// At most 500 sessions per call: `remaining` says whether to call again.
export function endTenantSessions(
  gateway: Gateway,
  tenant: string,
): Promise<GatewayResult<EndTenantSessionsResponse>> {
  return adminCall(gateway, 'DELETE', tenant, ['sessions'], {
    schema: endTenantSessionsResponseSchema,
  });
}
