import { isRefused } from '#/shared/service/failure';
import type { Read } from '#/shared/service/read';
import type { GatewayFailure } from '#/shared/service/result';

function isTag(value: unknown): value is string {
  return typeof value === 'string';
}

// The tenant's supported languages out of its settings record, which the
// contract types loosely.
export function offeredLocales(settings: Readonly<Record<string, unknown>>): string[] {
  const supported = settings.supported_locales;
  return Array.isArray(supported) ? supported.filter(isTag) : [];
}

interface SettingsRead {
  status: 'loading' | 'ready' | 'missing' | 'failed';
  data: Readonly<Record<string, unknown>> | undefined;
  failure: GatewayFailure | null;
  retry: () => void;
}

// The tenant's languages as a read: a caller without `manage-tenant` is
// refused the settings, and says so rather than offering none.
export function offeredRead(settings: SettingsRead): Read<string[]> {
  if (settings.data !== undefined) return { status: 'ready', data: offeredLocales(settings.data) };
  if (settings.status === 'loading') return { status: 'loading' };
  return {
    status: 'failed',
    refused: settings.failure !== null && isRefused(settings.failure),
    retry: settings.retry,
  };
}
