import type { ThemeView } from '@odudu/contracts/admin';
import { isRefused } from '#/shared/service/failure';
import type { Read } from '#/shared/service/read';
import type { GatewayFailure } from '#/shared/service/result';
import type { ThemeScope } from '#/features/branding/service/scope';

export const TENANT_LAYER_LOADING =
  'Reading the tenant’s theme, to say which of its pieces this hides…';

export const TENANT_LAYER_REFUSED =
  'The tenant’s theme can be read only with the manage-tenant capability, so a piece here cannot say which of the tenant’s it hides. The client’s own pieces are unaffected.';

export const TENANT_LAYER_FAILED =
  'The tenant’s theme could not be read, so a piece cannot say what it hides.';

interface ThemeRecordRead {
  status: 'loading' | 'ready' | 'missing' | 'failed';
  data: ThemeView | undefined;
  failure: GatewayFailure | null;
  retry: () => void;
}

// What lies under a client's theme, read from the tenant's published one; a
// tenant's own theme lies over nothing but Instrument's, so it reads nothing.
// A caller who may not read the tenant's theme is told so, not left waiting.
export function tenantLayerRead(
  scope: ThemeScope,
  canRead: boolean,
  record: ThemeRecordRead,
): Read<ThemeView> | null {
  if (scope.kind === 'tenant') return null;
  if (!canRead) return { status: 'failed', refused: true, retry: record.retry };
  if (record.data !== undefined) return { status: 'ready', data: record.data };
  if (record.status === 'loading') return { status: 'loading' };
  return {
    status: 'failed',
    refused: record.failure !== null && isRefused(record.failure),
    retry: record.retry,
  };
}

// The scope with the tenant's theme under it once that is known.
export function placedOver(scope: ThemeScope, layer: Read<ThemeView> | null): ThemeScope {
  if (scope.kind === 'tenant' || layer === null || layer.status !== 'ready') return scope;
  return { ...scope, below: layer.data };
}

// What to say beside a client's pieces when the tenant's theme is not known.
export function tenantLayerNote(layer: Read<ThemeView> | null): string | null {
  if (layer === null || layer.status === 'ready') return null;
  if (layer.status === 'loading') return TENANT_LAYER_LOADING;
  return layer.refused ? TENANT_LAYER_REFUSED : TENANT_LAYER_FAILED;
}
