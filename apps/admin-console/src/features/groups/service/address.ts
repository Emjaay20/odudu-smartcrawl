import type { Group, GroupRecord } from '@odudu/contracts/admin';
import { resourceAddress, withSearch } from '#/shared/service/address';
import { type Loss, type OwnAccess, type Asked } from '#/shared/service/capabilities';

export type { Group, GroupRecord };

export { lossText, possibleLoss } from '#/shared/service/capabilities';

export type { Loss, OwnAccess };

const groups = resourceAddress({ segment: 'groups', group: 'Identity', label: 'Groups' });

export const { listHref: groupsHref, recordHref: groupHref, trail: groupsTrail } = groups;

export function newGroupHref(tenant: string, parent?: string): string {
  return withSearch(`${groupsHref(tenant)}/new`, { parent });
}

export type { Asked };
