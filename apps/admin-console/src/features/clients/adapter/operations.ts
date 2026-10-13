import {
  clientInstallationSchema,
  countResponseSchema,
  evaluateClaimsResponseSchema,
  listLogoutDeliveriesResponseSchema,
  listTenantSessionsResponseSchema,
  revokeClientGrantsResponseSchema,
  type ClientInstallation,
  type CountResponse,
  type EvaluateClaimsResponse,
  type ListLogoutDeliveriesResponse,
  type ListTenantSessionsResponse,
  type RevokeClientGrantsResponse,
} from '@odudu/contracts/admin';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { adminCall } from '#/shared/adapter/route';

export function readClientSessions(
  gateway: Gateway,
  tenant: string,
  clientDbId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListTenantSessionsResponse>> {
  return adminCall(gateway, 'GET', tenant, ['clients', clientDbId, 'sessions'], {
    query,
    schema: listTenantSessionsResponseSchema,
  });
}

// The sessions holding a grant through the client, bounded by the count's own cap.
export function readClientSessionCount(
  gateway: Gateway,
  tenant: string,
  clientDbId: string,
): Promise<GatewayResult<CountResponse>> {
  const query = new URLSearchParams({ client: clientDbId });
  return adminCall(gateway, 'GET', tenant, ['sessions', 'count'], {
    query,
    schema: countResponseSchema,
  });
}

// At most 10,000 grants per call: `remaining` says whether to call again.
export function revokeClientGrants(
  gateway: Gateway,
  tenant: string,
  clientDbId: string,
): Promise<GatewayResult<RevokeClientGrantsResponse>> {
  return adminCall(gateway, 'DELETE', tenant, ['clients', clientDbId, 'grants'], {
    schema: revokeClientGrantsResponseSchema,
  });
}

export function readLogoutDeliveries(
  gateway: Gateway,
  tenant: string,
  clientDbId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListLogoutDeliveriesResponse>> {
  return adminCall(gateway, 'GET', tenant, ['clients', clientDbId, 'logout-deliveries'], {
    query,
    schema: listLogoutDeliveriesResponseSchema,
  });
}

export function readInstallation(
  gateway: Gateway,
  tenant: string,
  clientDbId: string,
): Promise<GatewayResult<ClientInstallation>> {
  return adminCall(gateway, 'GET', tenant, ['clients', clientDbId, 'installation'], {
    schema: clientInstallationSchema,
  });
}

// The claims a request for `subject` and `scope` would be issued, signing nothing.
export function evaluateClaims(
  gateway: Gateway,
  tenant: string,
  clientDbId: string,
  request: { subject: string; scope: string },
): Promise<GatewayResult<EvaluateClaimsResponse>> {
  const query = new URLSearchParams({ subject: request.subject });
  if (request.scope.trim() !== '') query.set('scope', request.scope.trim());
  return adminCall(gateway, 'GET', tenant, ['clients', clientDbId, 'evaluate'], {
    query,
    schema: evaluateClaimsResponseSchema,
  });
}
