import { z, type ZodType } from 'zod';
import { countResponseSchema, type CountResponse } from '@odudu/contracts/admin';
import type { Gateway, GatewayResult, Method, RequestOptions } from '#/shared/transport/gateway';

export const nothing = z.undefined();

// The gateway's mirror of a tenant's discovery document has no contract in
// @odudu/contracts, so it is held only to what the pages read.
export const discoverySchema = z.looseObject({ issuer: z.string() });

export function tenantPath(tenant: string): string {
  return encodeURIComponent(tenant);
}

export function segment(id: string): string {
  return encodeURIComponent(id);
}

type TenantRead<T> = (
  gateway: Gateway,
  tenant: string,
  query: URLSearchParams,
) => Promise<GatewayResult<T>>;

interface CallOptions<T> extends RequestOptions<T> {
  query?: URLSearchParams;
}

// One call under /admin/tenants/<tenant>/: every part is encoded as a path
// segment, so a part is a name or an id and never a path of its own.
export function adminCall<T>(
  gateway: Gateway,
  method: Method,
  tenant: string,
  parts: readonly string[],
  { query, ...options }: CallOptions<T>,
): Promise<GatewayResult<T>> {
  const path = [tenantPath(tenant), ...parts.map(segment)].join('/');
  const search = query === undefined ? '' : `?${query.toString()}`;
  return gateway.request(method, `admin/tenants/${path}${search}`, options);
}

function reader<T>(parts: readonly string[], schema: ZodType<T>): TenantRead<T> {
  return (gateway, tenant, query) => adminCall(gateway, 'GET', tenant, parts, { query, schema });
}

export function listReader<T>(resource: string, schema: ZodType<T>): TenantRead<T> {
  return reader([resource], schema);
}

export function countReader(resource: string): TenantRead<CountResponse> {
  return reader([resource, 'count'], countResponseSchema);
}
