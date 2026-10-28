import type { PublishThemeResponse, ThemeView } from '@odudu/contracts/admin';
import { useQueryClient } from '@tanstack/react-query';
import { publishTheme, resetTheme, restoreVersion } from '#/features/branding/adapter/theme';
import { scopeKeyPart, themeRecord, type ThemeScope } from '#/features/branding/service';
import { recordKey, themeVersionsKey } from '#/shared/repository/queryKeys';
import { useInvalidate } from '#/shared/repository/useInvalidate';
import type { RecordEntry } from '#/shared/repository/useRecord';
import { useGatewayWrite, type Write } from '#/shared/repository/useWrite';
import { isStale } from '#/shared/service/failure';
import type { GatewayResult, GatewaySuccess } from '#/shared/transport/gateway';

export interface ThemeWrites {
  publish: Write<string, GatewayResult<PublishThemeResponse>>;
  restore: Write<string, GatewayResult<ThemeView>>;
  reset: Write<void, GatewayResult<ThemeView>>;
}

// Publishing, restoring and resetting each answer the theme as it now stands,
// which replaces the record so the sections rebase on it, and each changes
// the versions list.
export function useThemeWrites(tenant: string, scope: ThemeScope): ThemeWrites {
  const client = useQueryClient();
  const { invalidate, invalidateExact } = useInvalidate();
  const key = recordKey(tenant, themeRecord(scope));
  const versions = themeVersionsKey(tenant, scopeKeyPart(scope));
  const keep = (result: GatewaySuccess<ThemeView>): void => {
    client.setQueryData<RecordEntry<ThemeView>>(key, { result, by: 'save' });
    invalidate(versions);
  };
  return {
    publish: useGatewayWrite({
      send: (gateway, tag: string) => publishTheme(gateway, tenant, scope, tag),
      onSuccess: (result) => {
        if (result.ok) keep(result);
        else if (isStale(result)) invalidateExact(key);
      },
    }),
    restore: useGatewayWrite({
      send: (gateway, versionId: string) => restoreVersion(gateway, tenant, scope, versionId),
      onSuccess: (result) => {
        if (result.ok) keep(result);
      },
    }),
    reset: useGatewayWrite({
      send: (gateway) => resetTheme(gateway, tenant, scope),
      onSuccess: (result) => {
        if (result.ok) keep(result);
      },
    }),
  };
}
