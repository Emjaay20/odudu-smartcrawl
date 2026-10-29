import type { ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useAuthority } from '#/features/session';
import { useThemeRecord } from '#/features/branding/repository/useThemeRecord';
import {
  NO_OUTCOME,
  placedOver,
  tabsWithEdits,
  tenantLayerRead,
  TENANT_SCOPE,
  themeRecord,
  type OfferedTab,
  type PublishOutcome,
  type ThemeScope,
} from '#/features/branding/service';
import { usePreview, type Preview } from '#/features/branding/usecase/usePreview';
import { useDirtySections } from '#/shared/repository/useDirtySections';
import { lacking } from '#/shared/service/access';
import type { Read } from '#/shared/service/read';
import type { RecordView } from '#/shared/service/record';

export interface ScopeBranding {
  record: RecordView;
  view: ThemeView | undefined;
  // The draft's tag, or the one that says there is none.
  tag: string | null;
  // The scope, with the tenant's theme under it once that is read.
  scope: ThemeScope;
  // What lies under a client's theme; null for the tenant's own.
  tenantLayer: Read<ThemeView> | null;
  preview: Preview;
  // What the last publish answered, kept here so each tab can mark its refusals.
  published: PublishOutcome;
  setPublished: (outcome: PublishOutcome) => void;
}

// One scope's theme: its record, the preview of its draft, and under a
// client the tenant's theme, which says what each of its pieces hides.
export function useScopeBranding(
  tenant: string,
  scope: ThemeScope,
  showsPreview: boolean,
): ScopeBranding {
  const record = useThemeRecord(tenant, scope);
  const authority = useAuthority(tenant);
  const canRead = lacking(authority, ['manage-tenant']).length === 0;
  const tenantRecord = useThemeRecord(tenant, TENANT_SCOPE, scope.kind === 'client' && canRead);
  const tenantLayer = tenantLayerRead(scope, canRead, tenantRecord);
  const placed = placedOver(scope, tenantLayer);
  const [published, setPublished] = useState(NO_OUTCOME);
  return {
    record,
    view: record.data,
    tag: record.etag,
    scope: placed,
    tenantLayer,
    preview: usePreview(tenant, placed, record.data, record.etag, showsPreview),
    published,
    setPublished,
  };
}

// The tabs of a scope's theme holding unsaved edits, for their dots.
export function useScopeEdits(tenant: string, scope: ThemeScope): ReadonlySet<OfferedTab> {
  return tabsWithEdits(useDirtySections(tenant, themeRecord(scope)));
}
