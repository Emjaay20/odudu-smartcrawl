import type { Group, GroupRecord } from '@odudu/contracts/admin';
import { resourceAddress } from '#/shared/service/address';
import { type Loss, type OwnAccess, type Asked } from '#/shared/service/capabilities';

export type { Group, GroupRecord };

export { lossText, possibleLoss } from '#/shared/service/capabilities';

export type { Loss, OwnAccess };

const groups = resourceAddress({ segment: 'groups', group: 'Identity', label: 'Groups' });

export const { listHref: groupsHref, recordHref: groupHref, trail: groupsTrail } = groups;

export function newGroupHref(tenant: string, parent?: string): string {
  const base = `${groupsHref(tenant)}/new`;
  return parent === undefined ? base : `${base}?parent=${encodeURIComponent(parent)}`;
}

export type { Asked };
