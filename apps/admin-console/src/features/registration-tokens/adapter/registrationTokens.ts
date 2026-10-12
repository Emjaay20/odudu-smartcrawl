import {
  listRegistrationTokensResponseSchema,
  mintRegistrationTokenResponseSchema,
  type ListRegistrationTokensResponse,
  type MintRegistrationTokenResponse,
} from '@odudu/contracts/admin';
import { z } from 'zod';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

const nothing = z.undefined();

function path(tenant: string): string {
  return encodeURIComponent(tenant);
}

export function readTokenPage(
  gateway: Gateway,
  tenant: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListRegistrationTokensResponse>> {
  return gateway.request(
    'GET',
    `admin/tenants/${path(tenant)}/registration-tokens?${query.toString()}`,
    {
      schema: listRegistrationTokensResponseSchema,
    },
  );
}

export function mintToken(
  gateway: Gateway,
  tenant: string,
  input: { uses: number; ttl_seconds: number },
): Promise<GatewayResult<MintRegistrationTokenResponse>> {
  return gateway.request('POST', `admin/tenants/${path(tenant)}/registration-tokens`, {
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
    `admin/tenants/${path(tenant)}/registration-tokens/${encodeURIComponent(id)}`,
    {
      schema: nothing,
    },
  );
}
