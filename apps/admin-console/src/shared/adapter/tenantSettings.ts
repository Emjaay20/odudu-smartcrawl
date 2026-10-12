import { settingsSchema, type Settings } from '@odudu/contracts/admin';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

function path(tenant: string): string {
  return encodeURIComponent(tenant);
}

export function readTenantSettings(
  gateway: Gateway,
  tenant: string,
): Promise<GatewayResult<Settings>> {
  return gateway.request('GET', `admin/tenants/${path(tenant)}/settings`, {
    schema: settingsSchema,
  });
}

// The answer is every setting again, with the ETag that now stands for them all.
export function amendTenantSettings(
  gateway: Gateway,
  tenant: string,
  changes: Readonly<Record<string, boolean | number | string>>,
  ifMatch: string,
): Promise<GatewayResult<Settings>> {
  return gateway.request('PATCH', `admin/tenants/${path(tenant)}/settings`, {
    body: changes,
    ifMatch,
    schema: settingsSchema,
  });
}
