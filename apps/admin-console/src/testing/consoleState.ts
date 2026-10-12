import type { QueryClient } from '@tanstack/react-query';
import { useDrafts } from '#/shared/repository/useDrafts';
import { recordKey, type RecordEntry } from '#/shared/repository/useRecord';
import { TENANT_SETTINGS_RECORD } from '#/shared/service/tenantSettings';

// What a session ending mid-edit would keep in the browser, as text.
export function draftsKept(owner: string): { sections: number; stored: string } {
  const sections = useDrafts.getState().keepDirty(owner);
  return { sections, stored: sessionStorage.getItem('odudu.console.drafts') ?? '' };
}

// The ETag the cached settings record carries, whoever saved it last.
export function cachedSettingsEtag(client: QueryClient, tenant: string): string | null {
  const entry = client.getQueryData<RecordEntry<unknown>>(
    recordKey(tenant, TENANT_SETTINGS_RECORD),
  );
  return entry?.result.etag ?? null;
}
