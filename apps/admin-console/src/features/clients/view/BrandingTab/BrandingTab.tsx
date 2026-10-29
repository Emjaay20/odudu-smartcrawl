import type { ReactNode } from 'react';
import type { ClientRecord } from '@odudu/contracts/admin';
import {
  BRANDING_SECTIONS_LABEL,
  BRANDING_TAB_LABELS,
  PagesTab,
  PreviewPane,
  SCOPED_TABS,
  ThemeTab,
  Workspace,
  type ScopedTab,
} from '#/features/branding';
import {
  BRANDING_FAILED,
  BRANDING_HELD,
  type BrandingOffer,
  BRANDING_LEAD,
  BRANDING_LOADING,
} from '#/features/clients/service';
import { useClientBranding } from '#/features/clients/usecase/useClientBranding';
import { andList } from '#/shared/service/format';
import type { AdminCapability } from '#/shared/service/principal';
import { Note, NoteCode } from '#/shared/view/Note';
import { ReadGate } from '#/shared/view/ReadGate';
import { recordTab } from '#/shared/view/RecordTab';
import { Tabs } from '#/shared/view/Tabs';

function Editing({ tenant, id }: { tenant: string; id: string }) {
  const page = useClientBranding(tenant, id);
  const { branding } = page;
  const { scope, preview, published, setPublished } = branding;
  return (
    <div className={recordTab.tab}>
      <p className={recordTab.rule}>{BRANDING_LEAD}</p>
      <ReadGate read={branding.record} label={BRANDING_LOADING} fields={4} failed={BRANDING_FAILED}>
        {(view, tag) => {
          const gone = branding.record.gone;
          const panels: Readonly<Record<ScopedTab, ReactNode>> = {
            theme: (
              <Workspace
                aside={<PreviewPane preview={preview} pickKind />}
                editor={
                  <ThemeTab
                    tenant={tenant}
                    scope={scope}
                    view={view}
                    tag={tag}
                    gone={gone}
                    published={published}
                    onPublished={setPublished}
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
                    gone={gone}
                    kind={preview.choice.kind}
                    onKind={preview.setKind}
                    published={published}
                  />
                }
              />
            ),
          };
          return (
            <Tabs
              label={BRANDING_SECTIONS_LABEL}
              selectedKey={page.tab}
              onSelectionChange={page.selectTab}
              tabs={SCOPED_TABS.map((tab) => ({
                id: tab,
                label: BRANDING_TAB_LABELS[tab],
                dirty: page.edited.has(tab),
                panel: panels[tab],
              }))}
            />
          );
        }}
      </ReadGate>
    </div>
  );
}

// The client's own look: what it sets over the tenant's theme, with a preview.
// Held back only for a missing capability: the theme applies no service-account
// ceiling, so a client the caller cannot change otherwise is edited here.
export function BrandingTab({
  tenant,
  client,
  offer,
  needs,
}: {
  tenant: string;
  client: ClientRecord;
  offer: BrandingOffer;
  needs: readonly AdminCapability[];
}) {
  if (offer === 'checking') return null;
  if (offer === 'held') {
    return (
      <div className={recordTab.tab}>
        <Note>
          {`${BRANDING_HELD} `}
          <NoteCode>{andList(needs)}</NoteCode>.
        </Note>
      </div>
    );
  }
  return <Editing tenant={tenant} id={client.id} />;
}
