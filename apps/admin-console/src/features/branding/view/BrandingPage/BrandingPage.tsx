import type { ReactNode } from 'react';
import { AreaGate, areaAt } from '#/features/shell';
import {
  BRANDING_DESCRIPTION,
  BRANDING_NOUN,
  BRANDING_SECTIONS_LABEL,
  BRANDING_TAB_LABELS,
  BRANDING_TITLE,
  OFFERED_TABS,
  TENANT_SCOPE,
  type OfferedTab,
} from '#/features/branding/service';
import { useBrandingPage } from '#/features/branding/usecase/useBrandingPage';
import { LanguagesTab } from '#/features/branding/view/LanguagesTab';
import { MailInherits, MailPreview } from '#/features/branding/view/MailTab';
import { PagesTab } from '#/features/branding/view/PagesTab';
import { PreviewPane } from '#/features/branding/view/PreviewPane';
import { ThemeTab } from '#/features/branding/view/ThemeTab';
import { RecordPage } from '#/shared/view/RecordPage';
import styles from '#/features/branding/view/BrandingPage/BrandingPage.module.css';

// The editor beside the preview of what it edits, and below it when narrow.
function Workspace({ editor, aside }: { editor: ReactNode; aside: ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.workspace}>
        <div className={styles.editor}>{editor}</div>
        <aside className={styles.preview}>{aside}</aside>
      </div>
    </div>
  );
}

function Branding({ tenant }: { tenant: string }) {
  const scope = TENANT_SCOPE;
  const page = useBrandingPage(tenant, scope);
  const { view, tag, preview, mail } = page;
  const panels: Readonly<Record<OfferedTab, ReactNode>> | null =
    view === undefined || tag === null
      ? null
      : {
          theme: (
            <Workspace
              aside={<PreviewPane preview={preview} pickKind />}
              editor={
                <ThemeTab
                  tenant={tenant}
                  scope={scope}
                  view={view}
                  tag={tag}
                  gone={page.record.gone}
                />
              }
            />
          ),
          pages: (
            <Workspace
              aside={<PreviewPane preview={preview} pickKind={false} />}
              editor={
                <PagesTab
                  tenant={tenant}
                  scope={scope}
                  view={view}
                  tag={tag}
                  gone={page.record.gone}
                  kind={preview.choice.kind}
                  onKind={preview.setKind}
                />
              }
            />
          ),
          mail: (
            <Workspace aside={<MailPreview mail={mail} />} editor={<MailInherits mail={mail} />} />
          ),
          languages: <LanguagesTab tenant={tenant} />,
        };
  return (
    <RecordPage
      record={page.record}
      kicker={tenant}
      title={BRANDING_TITLE}
      description={BRANDING_DESCRIPTION}
      noun={BRANDING_NOUN}
      label={BRANDING_SECTIONS_LABEL}
      tab={page.tab}
      onTabChange={page.selectTab}
      tabs={OFFERED_TABS.map((tab) => ({
        id: tab,
        label: BRANDING_TAB_LABELS[tab],
        dirty: page.dirty.has(tab),
        panel: panels === null ? null : panels[tab],
      }))}
    />
  );
}

export function BrandingPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('branding')} title={BRANDING_TITLE}>
      <Branding tenant={tenant} />
    </AreaGate>
  );
}
