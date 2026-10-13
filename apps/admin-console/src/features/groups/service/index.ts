export {
  type Group,
  type GroupRecord,
  lossText,
  possibleLoss,
  type Loss,
  type OwnAccess,
  groupsHref,
  newGroupHref,
  groupHref,
  groupsTrail,
  type Asked,
} from '#/features/groups/service/address';
export {
  GROUP_TABS,
  type GroupTab,
  GROUP_TAB_LABELS,
  groupRecord,
  groupRolesRecord,
  TAB_RECORDS,
} from '#/features/groups/service/tabs';
export {
  NAME_FIXED,
  PLACE_LABEL,
  DEFAULT_LABEL,
  NAME_TAKEN,
} from '#/features/groups/service/labels';
export {
  moveUnavailable,
  moveRefusal,
  type ReachLines,
  reachLines,
  defaultBlock,
  parentUnavailable,
  type Defaulting,
  defaultingOf,
  roleUnavailable,
} from '#/features/groups/service/blocks';
export { type Change, selfLoss, lossOf, type Readiness } from '#/features/groups/service/loss';
export {
  type GroupRead,
  type Ceiling,
  groupCeiling,
  createUnderHref,
  groupReadiness,
  createHeld,
  placeText,
  newGroupPlace,
  parentPathOf,
  parentPlace,
  ceilingCaller,
  ceilingParentReach,
  ceilingLines,
} from '#/features/groups/service/ceiling';
export {
  moveConfirmation,
  deleteConsequence,
  subtreeDeletedText,
  rolesConfirmation,
} from '#/features/groups/service/confirm';
export { keptRoles, reachOfRoles } from '#/features/groups/service/mapped';
