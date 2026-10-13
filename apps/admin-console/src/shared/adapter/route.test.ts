import { describe, expect, it } from 'vitest';
import { discoverySchema, nothing, segment, tenantPath } from '#/shared/adapter/route';

describe('route helpers', () => {
  it('encodes a tenant name and an id for a path segment', () => {
    expect(tenantPath('acme corp')).toBe('acme%20corp');
    expect(segment('a/b?c')).toBe('a%2Fb%3Fc');
  });

  it('accepts an empty body and refuses any other', () => {
    expect(nothing.safeParse(undefined).success).toBe(true);
    expect(nothing.safeParse({}).success).toBe(false);
  });

  it('holds a discovery document to its issuer and keeps the rest', () => {
    expect(discoverySchema.parse({ issuer: 'https://x', extra: 1 })).toEqual({
      issuer: 'https://x',
      extra: 1,
    });
    expect(discoverySchema.safeParse({}).success).toBe(false);
  });
});
