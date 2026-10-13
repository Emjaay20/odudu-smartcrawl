import { z, type ZodType } from 'zod';
import { countResponseSchema, type CountResponse } from '@odudu/contracts/admin';
import type { Gateway, GatewayResult, Method, RequestOptions } from '#/shared/transport/gateway';

export const nothing = z.undefined();

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

// One call under /admin/: every part is encoded as a path segment, so a
// part is a name or an id and never a path of its own.
export function adminRootCall<T>(
  gateway: Gateway,
  method: Method,
  parts: readonly string[],
  { query, ...options }: CallOptions<T>,
): Promise<GatewayResult<T>> {
  const search = query === undefined ? '' : `?${query.toString()}`;
  return gateway.request(method, `admin/${parts.map(segment).join('/')}${search}`, options);
}

// One call under /admin/tenants/<tenant>/.
export function adminCall<T>(
  gateway: Gateway,
  method: Method,
  tenant: string,
  parts: readonly string[],
  options: CallOptions<T>,
): Promise<GatewayResult<T>> {
  return adminRootCall(gateway, method, ['tenants', tenant, ...parts], options);
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
