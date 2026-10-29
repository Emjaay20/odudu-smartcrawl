import { useState } from 'react';
import {
  clientScope,
  selectScopeTab,
  showsPreview,
  tenantLayerNote,
  useScopeBranding,
  useScopeEdits,
  type ScopeBranding,
  type ScopeTab,
} from '#/features/branding';

export interface ClientBranding {
  branding: ScopeBranding;
  tab: ScopeTab;
  selectTab: (tab: string) => void;
  // Tabs of the client's theme with a section holding unsaved edits.
  edited: ReadonlySet<string>;
  // Why a piece cannot say which of the tenant's it hides, while that is so.
  layerNote: string | null;
}

// The client's own theme: the same editors as the tenant's, over its record.
export function useClientBranding(tenant: string, id: string): ClientBranding {
  const [tab, setTab] = useState<ScopeTab>('theme');
  const scope = clientScope(id);
  const branding = useScopeBranding(tenant, scope, showsPreview(tab));
  return {
    branding,
    tab,
    selectTab: (next) => {
      selectScopeTab(next, setTab);
    },
    edited: useScopeEdits(tenant, scope),
    layerNote: tenantLayerNote(branding.tenantLayer),
  };
}
