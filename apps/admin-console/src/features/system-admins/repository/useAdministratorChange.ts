import { useQueryClient } from '@tanstack/react-query';
import { grantHoldings, type Refused } from '#/shared/repository/administratorRoles';
import { SYSTEM_TENANT } from '#/shared/service/principal';
import { useWrite } from '#/shared/repository/useWrite';

export interface AdministratorGrant {
  busy: boolean;
  grant: (subjectId: string, holdings: readonly string[]) => Promise<Refused | null>;
}

// Either way the holders are read again, since a refusal can mean the list
// was already out of date.
export function useAdministratorGrant(): AdministratorGrant {
  const client = useQueryClient();
  const grant = useWrite({
    send: (gateway, { subjectId, holdings }: { subjectId: string; holdings: readonly string[] }) =>
      grantHoldings(gateway, SYSTEM_TENANT, subjectId, holdings),
    onSettled: () => {
      for (const kind of ['list', 'count', 'holders']) {
        client.invalidateQueries({ queryKey: [kind, SYSTEM_TENANT] }).catch(() => undefined);
      }
    },
  });
  return {
    busy: grant.busy,
    grant: (subjectId, holdings) => grant.run({ subjectId, holdings }),
  };
}
