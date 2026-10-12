import {
  listKeysResponseSchema,
  signingKeySchema,
  type ListKeysResponse,
  type SigningKey,
  type SigningKeyAlg,
} from '@odudu/contracts/admin';
import { z } from 'zod';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

const nothing = z.undefined();

export function readKeyPage(
  gateway: Gateway,
  tenant: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListKeysResponse>> {
  return gateway.request(
    'GET',
    `admin/tenants/${encodeURIComponent(tenant)}/keys?${query.toString()}`,
    {
      schema: listKeysResponseSchema,
    },
  );
}

export function stageKey(
  gateway: Gateway,
  tenant: string,
  alg: SigningKeyAlg,
): Promise<GatewayResult<SigningKey>> {
  return gateway.request('POST', `admin/tenants/${encodeURIComponent(tenant)}/keys`, {
    body: { alg },
    schema: signingKeySchema,
  });
}

export function promoteKey(
  gateway: Gateway,
  tenant: string,
  id: string,
): Promise<GatewayResult<SigningKey>> {
  return gateway.request(
    'POST',
    `admin/tenants/${encodeURIComponent(tenant)}/keys/${encodeURIComponent(id)}/promote`,
    { schema: signingKeySchema },
  );
}

export function retireKey(
  gateway: Gateway,
  tenant: string,
  id: string,
): Promise<GatewayResult<SigningKey>> {
  return gateway.request(
    'POST',
    `admin/tenants/${encodeURIComponent(tenant)}/keys/${encodeURIComponent(id)}/retire`,
    { schema: signingKeySchema },
  );
}

export function deleteKey(
  gateway: Gateway,
  tenant: string,
  id: string,
): Promise<GatewayResult<undefined>> {
  return gateway.request(
    'DELETE',
    `admin/tenants/${encodeURIComponent(tenant)}/keys/${encodeURIComponent(id)}`,
    { schema: nothing },
  );
}
