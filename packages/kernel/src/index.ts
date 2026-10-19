export { KERNEL_VERSION } from '#/version';
export { OduduError, type ErrorCode } from '#/errors';
export { BIDI_REFUSED, BidiControlError, containsBidiControl, refuseBidiControls } from '#/bidi';
export { type Clock, systemClock, FakeClock } from '#/clock';
export { isUuid, newId, scriptNonce } from '#/ids';
export {
  DEFAULT_PAGE_LOCALE,
  INSTRUMENT_STYLESHEET,
  PRODUCT_NAME,
  type PageLocale,
  type PageScript,
  type RenderedPage,
  pageHeaders,
  reloadOnRestore,
} from '#/page';
export {
  MAX_PASSWORD_LENGTH,
  PASSWORD_TOO_LONG,
  readPasswordField,
  type PasswordField,
} from '#/password-field';
export {
  type Config,
  consoleBaseUrl,
  DEFAULT_CONSOLE_DIR,
  DEFAULT_INSTRUMENT_DIR,
  DEFAULT_OUTBOX_MAX_ATTEMPTS,
  loadConfig,
} from '#/config';
export {
  DEFAULT_STATIC_TREE_LIMITS,
  readStaticTree,
  type StaticFile,
  type StaticTreeLimits,
} from '#/static-tree';
export { type Logger } from '#/logger';
export { ModuleRegistry, type ModuleContext, type OduduModule } from '#/registry';
export { ClaimMapperRegistry, type ClaimMapper } from '#/registries/claim-mapper';
