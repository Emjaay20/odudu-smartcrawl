import type { ThemeView } from '@odudu/contracts/admin';
import { describe, expect, it } from 'vitest';
import {
  mayReadTenantTheme,
  placedOver,
  TENANT_LAYER_FAILED,
  TENANT_LAYER_LOADING,
  TENANT_LAYER_REFUSED,
  tenantLayerNote,
  tenantLayerRead,
} from '#/features/branding/service/layers';
import type { Authority } from '#/shared/service/principal';
import { themeView } from '#/testing/brandingFixtures';

const retry = () => undefined;
const TENANT_VIEW = themeView({ sources: { 'tokens.light': 'tenant' } }) as ThemeView;
const CLIENT = { kind: 'client' as const, id: 'c1' };

function record(
  status: 'loading' | 'ready' | 'missing' | 'failed',
  data?: ThemeView,
  refused = false,
) {
  return {
    status,
    data,
    failure: refused
      ? ({
          ok: false,
          kind: 'problem',
          problem: { type: 'about:blank', title: 'Forbidden', status: 403 },
        } as const)
      : null,
    retry,
  };
}

describe('the tenant theme under a client’s', () => {
  it('reads nothing for the tenant’s own theme', () => {
    expect(tenantLayerRead({ kind: 'tenant' }, true, record('ready', TENANT_VIEW))).toBeNull();
  });

  it('is the tenant’s theme once read, loading until then', () => {
    expect(tenantLayerRead(CLIENT, true, record('ready', TENANT_VIEW))).toEqual({
      status: 'ready',
      data: TENANT_VIEW,
    });
    expect(tenantLayerRead(CLIENT, true, record('loading'))).toEqual({ status: 'loading' });
  });

  it('says a caller without the capability was refused, without asking', () => {
    expect(tenantLayerRead(CLIENT, false, record('loading'))).toMatchObject({
      status: 'failed',
      refused: true,
    });
  });

  it('tells a refusal from any other failure', () => {
    expect(tenantLayerRead(CLIENT, true, record('failed', undefined, true))).toMatchObject({
      refused: true,
    });
    expect(tenantLayerRead(CLIENT, true, record('failed'))).toMatchObject({ refused: false });
  });

  it('places the scope over the tenant’s theme only once it is known', () => {
    expect(placedOver(CLIENT, { status: 'ready', data: TENANT_VIEW })).toEqual({
      ...CLIENT,
      below: TENANT_VIEW,
    });
    expect(placedOver(CLIENT, { status: 'loading' })).toBe(CLIENT);
    expect(placedOver(CLIENT, null)).toBe(CLIENT);
    expect(placedOver({ kind: 'tenant' }, { status: 'ready', data: TENANT_VIEW })).toEqual({
      kind: 'tenant',
    });
  });

  it('says why it cannot name what a piece hides', () => {
    expect(tenantLayerNote(null)).toBeNull();
    expect(tenantLayerNote({ status: 'ready', data: TENANT_VIEW })).toBeNull();
    expect(tenantLayerNote({ status: 'loading' })).toBe(TENANT_LAYER_LOADING);
    expect(tenantLayerNote({ status: 'failed', refused: true, retry })).toBe(TENANT_LAYER_REFUSED);
    expect(tenantLayerNote({ status: 'failed', refused: false, retry })).toBe(TENANT_LAYER_FAILED);
  });
});

describe('who may read the tenant’s theme', () => {
  it('is whoever holds manage-tenant, and anyone until whoami has answered', () => {
    expect(mayReadTenantTheme(undefined)).toBe(true);
    expect(mayReadTenantTheme({ capabilities: ['manage-tenant'] } as Authority)).toBe(true);
    expect(mayReadTenantTheme({ capabilities: ['manage-clients'] } as Authority)).toBe(false);
  });
});
