import { blockedChanges, lacking, type Change } from '#/shared/service/access';
import { administratorNeeds } from '#/shared/service/administrators';
import type { AdminCapability, Authority } from '#/shared/service/principal';

export interface TenantRecordAccess {
  // What reading the record needs that whoami says is missing.
  readNeeds: readonly AdminCapability[];
  // What adding an administrator needs that whoami says is missing.
  addNeeds: readonly AdminCapability[];
  // The changes whoami rules out, for the page's one line.
  blocked: Change | null;
}

// A tenant's record is read with manage-tenant, which the System area's own
// manage-tenants does not carry.
export function tenantRecordAccess(
  authority: Authority | undefined,
  name: string,
): TenantRecordAccess {
  const adding = administratorNeeds(name, { subjectId: null, granted: false });
  return {
    readNeeds: lacking(authority, ['manage-tenant']),
    addNeeds: lacking(authority, adding),
    blocked: blockedChanges(authority, [{ change: 'add their administrators', needs: adding }]),
  };
}
