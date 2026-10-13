import {
  smtpConfigSchema,
  testSmtpResponseSchema,
  type PutSmtpRequest,
  type SmtpConfig,
  type TestSmtpResponse,
} from '@odudu/contracts/admin';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { nothing, tenantPath } from '#/shared/adapter/route';

// A full replace, except for the password: left out, the stored one is kept.
export function putSmtp(
  gateway: Gateway,
  tenant: string,
  relay: PutSmtpRequest,
  ifMatch: string,
): Promise<GatewayResult<SmtpConfig>> {
  return gateway.request('PUT', `admin/tenants/${tenantPath(tenant)}/smtp`, {
    body: relay,
    ifMatch,
    schema: smtpConfigSchema,
  });
}

export function deleteSmtp(gateway: Gateway, tenant: string): Promise<GatewayResult<undefined>> {
  return gateway.request('DELETE', `admin/tenants/${tenantPath(tenant)}/smtp`, { schema: nothing });
}

export function testSmtp(
  gateway: Gateway,
  tenant: string,
  to: string,
): Promise<GatewayResult<TestSmtpResponse>> {
  return gateway.request('POST', `admin/tenants/${tenantPath(tenant)}/smtp/test`, {
    body: { to },
    schema: testSmtpResponseSchema,
  });
}
