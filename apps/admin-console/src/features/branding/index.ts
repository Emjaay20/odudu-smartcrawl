export { BrandingPage } from '#/features/branding/view/BrandingPage';
export { PagesPanel, ThemePanel } from '#/features/branding/view/ScopePanels';
export {
  useScopeBranding,
  useScopeEdits,
  type ScopeBranding,
} from '#/features/branding/usecase/useScopeBranding';
export {
  BRANDING_SECTIONS_LABEL,
  BRANDING_TAB_LABELS,
  clientScope,
  SCOPED_TABS,
  selectScopedTab,
  showsPreview,
  type ScopedTab,
  type ThemeScope,
} from '#/features/branding/service';
