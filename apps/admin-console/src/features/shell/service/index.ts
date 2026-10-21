export {
  type Area,
  type RailLink,
  type RailSection,
  OVERVIEW,
  TENANT_AREAS,
  SYSTEM_AREAS,
  EVERY_AREA,
  areaAt,
} from '#/features/shell/service/areas';
export {
  holds,
  showsSystemArea,
  actsWithSystemAuthority,
  areaHref,
  systemRecordHref,
  railGroups,
  currentHref,
} from '#/features/shell/service/rail';
export {
  type PendingShape,
  type PendingPage,
  pendingPage,
  type AreaAccess,
  areaAccess,
} from '#/features/shell/service/pending';
export {
  brandText,
  PRODUCT_NAME,
  areasLabel,
  signedInFrom,
  checkingText,
  tenantNotFoundText,
  dialogOpen,
  pathnameOf,
} from '#/features/shell/service/frame';
export { THEME_CHOICES, themeChoice } from '#/features/shell/service/theme';
