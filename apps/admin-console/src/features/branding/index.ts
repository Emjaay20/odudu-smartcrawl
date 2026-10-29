export { BrandingPage } from '#/features/branding/view/BrandingPage';
export { Workspace } from '#/features/branding/view/Workspace';
export { ThemeTab } from '#/features/branding/view/ThemeTab';
export { PagesTab } from '#/features/branding/view/PagesTab';
export { PreviewPane } from '#/features/branding/view/PreviewPane';
export {
  useScopeBranding,
  useScopeEdits,
  type ScopeBranding,
} from '#/features/branding/usecase/useScopeBranding';
export {
  BRANDING_TAB_LABELS,
  clientScope,
  SCOPE_TABS,
  selectScopeTab,
  showsPreview,
  tenantLayerNote,
  type ScopeTab,
  type ThemeScope,
} from '#/features/branding/service';
