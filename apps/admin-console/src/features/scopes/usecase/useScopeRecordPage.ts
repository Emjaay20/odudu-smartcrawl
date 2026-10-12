import type { ClientScope } from '@odudu/contracts/admin';
import { useScopeRecord } from '#/features/scopes/repository/useScopeRecord';
import { SCOPE_TABS, type ScopeTab, TAB_RECORDS } from '#/features/scopes/service';
import { useDirtyRecords } from '#/shared/repository/useDirtyRecords';
import { useRecordTab } from '#/shared/repository/useRecordTab';
import { dirtyTabs, tabNamed, type RecordView } from '#/shared/service/record';

export interface ScopeRecordPage {
  record: RecordView;
  scope: ClientScope | undefined;
  etag: string | null;
  tab: ScopeTab;
  selectTab: (tab: string) => void;
  // Tabs with a section holding unsaved edits, for their dots.
  dirty: ReadonlySet<ScopeTab>;
}

export function useScopeRecordPage(tenant: string, id: string): ScopeRecordPage {
  const record = useScopeRecord(tenant, id);
  const { tab, selectTab } = useRecordTab(SCOPE_TABS);
  const recordsOf = (each: ScopeTab): readonly string[] => TAB_RECORDS[each](id);
  const edited = useDirtyRecords(tenant, SCOPE_TABS.flatMap(recordsOf));
  return {
    record,
    scope: record.data,
    etag: record.etag,
    tab,
    selectTab: (next) => {
      const chosen = tabNamed(SCOPE_TABS, next);
      if (chosen !== undefined) selectTab(chosen);
    },
    dirty: dirtyTabs(SCOPE_TABS, recordsOf, edited),
  };
}
