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
  theme: ['colours', 'images'],
  pages: ['templates'],
  mail: [],
  languages: [],
};

export function tabsWithEdits(dirty: ReadonlySet<string>): ReadonlySet<OfferedTab> {
  return new Set(
    OFFERED_TABS.filter((tab) => BRANDING_TAB_SECTIONS[tab].some((section) => dirty.has(section))),
  );
}
