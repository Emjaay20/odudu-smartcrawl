// Every tab of the Branding area, in the order they join it.
export const BRANDING_TABS = ['theme', 'pages', 'mail', 'languages'] as const;

export type BrandingTab = (typeof BRANDING_TABS)[number];

// The tabs the area shows, each with a view.
export const OFFERED_TABS = BRANDING_TABS;

export type OfferedTab = (typeof OFFERED_TABS)[number];

export const BRANDING_TAB_LABELS: Readonly<Record<BrandingTab, string>> = {
  theme: 'Theme',
  pages: 'Pages',
  mail: 'Mail',
  languages: 'Languages',
};

// The sections each tab saves, which carry its unsaved-changes dot.
export const BRANDING_TAB_SECTIONS: Readonly<Record<BrandingTab, readonly string[]>> = {
  theme: ['colours', 'images', 'stylesheet'],
  pages: ['templates'],
  mail: [],
  languages: [],
};

export function tabsWithEdits(dirty: ReadonlySet<string>): ReadonlySet<OfferedTab> {
  return new Set(
    OFFERED_TABS.filter((tab) => BRANDING_TAB_SECTIONS[tab].some((section) => dirty.has(section))),
  );
}

// The tabs that frame a preview of a page.
export function showsPreview(tab: BrandingTab): boolean {
  return tab === 'theme' || tab === 'pages';
}

// A client's Branding holds the two tabs that are about the client's own
// pages; mail and languages belong to the tenant.
export const SCOPED_TABS = ['theme', 'pages'] as const;

export type ScopedTab = (typeof SCOPED_TABS)[number];

// Runs `select` for a tab a scope has, and for no other name.
export function selectScopedTab(name: string, select: (tab: ScopedTab) => void): void {
  const tab = SCOPED_TABS.find((each) => each === name);
  if (tab !== undefined) select(tab);
}
