export {
  newScopeHref,
  scopeHref,
  scopesHref,
  scopesTrail,
} from '#/features/scopes/service/address.ts';
export {
  SCOPE_TAB_LABELS,
  SCOPE_TABS,
  type ScopeTab,
  TAB_RECORDS,
  scopeMappersRecord,
  scopeRecord,
  scopeRolesRecord,
} from '#/features/scopes/service/tabs.ts';
export {
  GUARDED_TEXT,
  isGuarded,
  scopeDeleteConsequence,
  scopeDeleteFailureText,
} from '#/features/scopes/service/guard.ts';
export {
  NONE_TEXT,
  mapperOptions,
  mappersFailure,
  mappersFailureText,
  mappersSummary,
} from '#/features/scopes/service/mappers.ts';
export {
  ASSIGNMENT_RULE,
  ASSIGNMENTS,
  assignedText,
  chosenClient,
  clientsOffered,
  assignmentOf,
  clientAssignmentFailure,
  clientsCount,
  unassignedText,
  withoutScope,
  withScopes,
} from '#/features/scopes/service/assignment.ts';
export {
  ACCESS_TOKEN_LABEL,
  assignmentName,
  CONSENT_RULE,
  consentGuard,
  ID_TOKEN_LABEL,
  NEW_CLIENT_LABEL,
  DESCRIPTION_RULE,
  displayOrderProblem,
  generalPatch,
  type GeneralValues,
  NAME_FIXED,
  NAME_TAKEN,
  NEW_CLIENT_CHOICES,
  scopeFailureFields,
} from '#/features/scopes/service/general.ts';
export {
  keptRoles,
  roleIndex,
  type ScopeRole,
  scopeRoleRows,
  scopeRoleUnavailable,
  withKept,
} from '#/features/scopes/service/roles.ts';
