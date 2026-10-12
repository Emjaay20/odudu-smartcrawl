import {
  smtpConfigSchema,
  testSmtpResponseSchema,
  type PutSmtpRequest,
  type SmtpConfig,
  type TestSmtpResponse,
} from '@odudu/contracts/admin';
import { z } from 'zod';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

const nothing = z.undefined();

function path(tenant: string): string {
  return encodeURIComponent(tenant);
}

export function readSmtp(gateway: Gateway, tenant: string): Promise<GatewayResult<SmtpConfig>> {
  return gateway.request('GET', `admin/tenants/${path(tenant)}/smtp`, { schema: smtpConfigSchema });
}

// A full replace, except for the password: left out, the stored one is kept.
export function putSmtp(
  gateway: Gateway,
  tenant: string,
  relay: PutSmtpRequest,
  ifMatch: string,
): Promise<GatewayResult<SmtpConfig>> {
  return gateway.request('PUT', `admin/tenants/${path(tenant)}/smtp`, {
    body: relay,
    ifMatch,
    schema: smtpConfigSchema,
  });
}

export function deleteSmtp(gateway: Gateway, tenant: string): Promise<GatewayResult<undefined>> {
  return gateway.request('DELETE', `admin/tenants/${path(tenant)}/smtp`, { schema: nothing });
}

export function testSmtp(
  gateway: Gateway,
  tenant: string,
  to: string,
): Promise<GatewayResult<TestSmtpResponse>> {
  return gateway.request('POST', `admin/tenants/${path(tenant)}/smtp/test`, {
    body: { to },
    schema: testSmtpResponseSchema,
  });
}
