import {
  listExecutionsResponseSchema,
  type ListExecutionsResponse,
  type ReplaceExecutionsRequest,
} from '@odudu/contracts/admin';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

function path(tenant: string): string {
  return encodeURIComponent(tenant);
}

export function readFlow(
  gateway: Gateway,
  tenant: string,
): Promise<GatewayResult<ListExecutionsResponse>> {
  return gateway.request('GET', `admin/tenants/${path(tenant)}/flow/executions`, {
    schema: listExecutionsResponseSchema,
  });
}

// The whole list replaces the flow, in the order it is given, on the ETag it was read with.
export function replaceFlow(
  gateway: Gateway,
  tenant: string,
  steps: ReplaceExecutionsRequest,
  ifMatch: string,
): Promise<GatewayResult<ListExecutionsResponse>> {
  return gateway.request('PUT', `admin/tenants/${path(tenant)}/flow/executions`, {
    body: steps,
    ifMatch,
    schema: listExecutionsResponseSchema,
  });
}
