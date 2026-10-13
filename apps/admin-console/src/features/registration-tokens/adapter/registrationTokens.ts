import {
  listRegistrationTokensResponseSchema,
  mintRegistrationTokenResponseSchema,
  type MintRegistrationTokenResponse,
} from '@odudu/contracts/admin';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { listReader, nothing, tenantPath } from '#/shared/adapter/route';

export const readTokenPage = listReader(
  'registration-tokens',
  listRegistrationTokensResponseSchema,
);

export function mintToken(
  gateway: Gateway,
  tenant: string,
  input: { uses: number; ttl_seconds: number },
): Promise<GatewayResult<MintRegistrationTokenResponse>> {
  return gateway.request('POST', `admin/tenants/${tenantPath(tenant)}/registration-tokens`, {
    body: input,
    schema: mintRegistrationTokenResponseSchema,
  });
}

export function revokeToken(
  gateway: Gateway,
  tenant: string,
  id: string,
): Promise<GatewayResult<undefined>> {
  return gateway.request(
    'DELETE',
    `admin/tenants/${tenantPath(tenant)}/registration-tokens/${encodeURIComponent(id)}`,
    {
      schema: nothing,
    },
  );
}
