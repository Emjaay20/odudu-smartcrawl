import {
  endSessionsResponseSchema,
  listConsentsResponseSchema,
  listGrantsResponseSchema,
  listSessionsResponseSchema,
  revokeGrantsResponseSchema,
  type EndSessionsResponse,
  type ListConsentsResponse,
  type ListGrantsResponse,
  type ListSessionsResponse,
  type RevokeGrantsResponse,
} from '@odudu/contracts/admin';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { adminCall, nothing } from '#/shared/adapter/route';

export function readSessions(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListSessionsResponse>> {
  return adminCall(gateway, 'GET', tenant, ['subjects', subjectId, 'sessions'], {
    query,
    schema: listSessionsResponseSchema,
  });
}

export function endSession(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  sessionId: string,
): Promise<GatewayResult<undefined>> {
  return adminCall(gateway, 'DELETE', tenant, ['subjects', subjectId, 'sessions', sessionId], {
    schema: nothing,
  });
}

export function endAllSessions(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<EndSessionsResponse>> {
  return adminCall(gateway, 'DELETE', tenant, ['subjects', subjectId, 'sessions'], {
    schema: endSessionsResponseSchema,
  });
}

export function readConsents(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListConsentsResponse>> {
  return adminCall(gateway, 'GET', tenant, ['subjects', subjectId, 'consents'], {
    query,
    schema: listConsentsResponseSchema,
  });
}

export function revokeConsent(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  clientId: string,
): Promise<GatewayResult<undefined>> {
  return adminCall(gateway, 'DELETE', tenant, ['subjects', subjectId, 'consents', clientId], {
    schema: nothing,
  });
}

export function readGrants(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListGrantsResponse>> {
  return adminCall(gateway, 'GET', tenant, ['subjects', subjectId, 'grants'], {
    query,
    schema: listGrantsResponseSchema,
  });
}

export function revokeGrants(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  clientId: string,
): Promise<GatewayResult<RevokeGrantsResponse>> {
  return adminCall(gateway, 'DELETE', tenant, ['subjects', subjectId, 'grants', clientId], {
    schema: revokeGrantsResponseSchema,
  });
}
