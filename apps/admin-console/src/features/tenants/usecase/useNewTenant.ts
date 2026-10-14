import { useState } from 'react';
import { draftOwner, usePrincipal } from '#/features/session';
import { useCreationProgress } from '#/features/tenants/repository/useCreation';
import { useSystemIssuer } from '#/features/tenants/repository/useSystemIssuer';
import {
  againOf,
  freshCreation,
  holdsText,
  systemAdminsHrefOf,
  systemHoldsText,
  tenantHref,
  unfinishedOf,
  type CreationFlow,
  type Unfinished,
} from '#/features/tenants/service';
import {
  useAdministratorStep,
  type AdministratorStep,
} from '#/features/tenants/usecase/useAdministratorStep';
import { useStepFeedback } from '#/features/tenants/usecase/useStepFeedback';
import { useTenantStep, type TenantStep } from '#/features/tenants/usecase/useTenantStep';
import { tenantPage } from '#/shared/service/address';

export type { AdministratorStep, TenantStep };

export interface DoneStep {
  step: 'done';
  tenant: string;
  username: string;
  // What they were given, as a sentence fragment: "tenant-admin".
  holds: string;
  // What a system administrator is said to hold, around "in system".
  systemHolds: string;
  // Starting over from a tenant's own administrator adds another to it.
  again: 'tenant' | 'administrator';
  systemAdminsHref: string | null;
  recordHref: string;
  enterHref: string;
}

export interface NewTenant {
  current: TenantStep | AdministratorStep | DoneStep;
  startOver: () => void;
  // A subject created but not finished, which starting over would drop.
  replacing: Unfinished | null;
  replace: () => void;
  keep: () => void;
}

// Each page shows its own flow only: creating a tenant, or adding one of
// system's administrators.
export function useNewTenant(flow: CreationFlow): NewTenant {
  const principal = usePrincipal();
  const owner = draftOwner(principal);
  const { creation, update } = useCreationProgress(owner, flow);
  const systemIssuer = useSystemIssuer();
  const feedback = useStepFeedback(update);
  const tenant = useTenantStep(creation, feedback, update, systemIssuer);
  const administrator = useAdministratorStep(creation, feedback, update, systemIssuer);
  const [replacing, setReplacing] = useState<Unfinished | null>(null);

  const { move } = feedback;
  const replace = (): void => {
    setReplacing(null);
    move(freshCreation(flow));
  };
  const restart = {
    startOver: (): void => {
      const unfinished = unfinishedOf(creation);
      if (unfinished === null) replace();
      else setReplacing(unfinished);
    },
    replacing,
    replace,
    keep: (): void => {
      setReplacing(null);
    },
  };

  const holds = creation.step === 'done' ? holdsText(creation.holdings) : '';
  const done: DoneStep | null =
    creation.step === 'done'
      ? {
          step: 'done',
          tenant: creation.tenant,
          username: creation.username,
          holds,
          systemHolds: systemHoldsText(holds),
          again: againOf(flow),
          systemAdminsHref: systemAdminsHrefOf(creation.tenant),
          recordHref: tenantHref(creation.tenant),
          enterHref: tenantPage(creation.tenant),
        }
      : null;
  const current = tenant ?? administrator ?? done;
  if (current === null) throw new Error(`the creation is at no step of its own: ${creation.step}`);
  return { ...restart, current };
}
