import type { ThemeView } from '@odudu/contracts/admin';
import { useThemeRecord } from '#/features/branding/repository/useThemeRecord';
import {
  OFFERED_TABS,
  selectOffered,
  tabsWithEdits,
  themeRecord,
  type OfferedTab,
  type ThemeScope,
} from '#/features/branding/service';
import { useMailTab, type MailTab } from '#/features/branding/usecase/useMailTab';
import { usePreview, type Preview } from '#/features/branding/usecase/usePreview';
import { useDirtySections } from '#/shared/repository/useDirtySections';
import { useRecordTab } from '#/shared/repository/useRecordTab';
import type { RecordView } from '#/shared/service/record';

export interface BrandingPage {
  record: RecordView;
  view: ThemeView | undefined;
  // The draft's tag, or the one that says there is none.
  tag: string | null;
  tab: OfferedTab;
  selectTab: (tab: string) => void;
  // Tabs with a section holding unsaved edits, for their dots.
  dirty: ReadonlySet<OfferedTab>;
  preview: Preview;
  mail: MailTab;
}

export function useBrandingPage(tenant: string, scope: ThemeScope): BrandingPage {
  const record = useThemeRecord(tenant, scope);
  const { tab, selectTab } = useRecordTab(OFFERED_TABS);
  const dirty = useDirtySections(tenant, themeRecord(scope));
  return {
    record,
    view: record.data,
    tag: record.etag,
    tab,
    selectTab: (next) => {
      selectOffered(next, selectTab);
    },
    dirty: tabsWithEdits(dirty),
    preview: usePreview(tenant, scope, record.data, record.etag),
    mail: useMailTab(tenant, record.data, tab === 'mail'),
  };
}
