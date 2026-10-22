export {
  newScopeHref,
  scopeHref,
  scopesHref,
  scopesTrail,
} from '#/features/scopes/service/address';
export {
  SCOPE_TAB_LABELS,
  SCOPE_TABS,
  type ScopeTab,
  TAB_RECORDS,
  scopeMappersRecord,
  scopeRecord,
  scopeRolesRecord,
} from '#/features/scopes/service/tabs';
export {
  GUARDED_TEXT,
  guardedText,
  isGuarded,
  scopeDeleteConsequence,
  scopeDeleteFailureText,
} from '#/features/scopes/service/guard';
export {
  type Impact,
  impactHeld,
  type ImpactRetry,
  impactRetry,
  impactOf,
  claimMappersOf,
  scopeDeleteDialogText,
  scopeDeleteWarning,
} from '#/features/scopes/service/deleteWarning';
export {
  type RestoreOffer,
  restoredText,
  restoreFailureText,
  restoreHeld,
  restoreOffer,
  restoreText,
} from '#/features/scopes/service/restore';
export {
  DEFAULT_MAPPER_NOTE,
  NONE_TEXT,
  boundAfter,
  mapperChecklist,
  type MapperOption,
  mappersFailure,
  mappersFailureText,
  mappersSummary,
  describeMappers,
} from '#/features/scopes/service/mappers';
export {
  chosenClient,
  clientsOffered,
  clientAssignmentFailure,
  clientsCount,
  withoutScope,
  withScopes,
} from '#/features/scopes/service/assignment';
export {
  ACCESS_TOKEN_LABEL,
  assignmentName,
  CONSENT_RULE,
  guardedConsent,
  ID_TOKEN_LABEL,
  NEW_CLIENT_LABEL,
  displayOrderProblem,
  generalPatch,
  type GeneralValues,
  NAME_FIXED,
  NEW_CLIENT_CHOICES,
  scopeFailureFields,
} from '#/features/scopes/service/general';
export { keptRoles } from '#/features/scopes/service/roles';
export {
  type Copying,
  type CopyPlan,
  type CopyRead,
  sourceDescription,
  copyBody,
  createBodyOf,
  copyHrefOf,
  copyingOf,
  copyingText,
  copyPlan,
  asksPart,
  copySourceOf,
  partMissed,
  type CopyPart,
  partialCopy,
  sourceBound,
  sourceRoles,
} from '#/features/scopes/service/copy';
