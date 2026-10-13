import { z } from 'zod';

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
