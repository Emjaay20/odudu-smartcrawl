import { smtpConfigSchema, type SmtpConfig } from '@odudu/contracts/admin';
import { tenantPath } from '#/shared/adapter/route';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

// The relay the tenant has set, read by the email page and the overview.
export function readSmtp(gateway: Gateway, tenant: string): Promise<GatewayResult<SmtpConfig>> {
  return gateway.request('GET', `admin/tenants/${tenantPath(tenant)}/smtp`, {
    schema: smtpConfigSchema,
  });
}
