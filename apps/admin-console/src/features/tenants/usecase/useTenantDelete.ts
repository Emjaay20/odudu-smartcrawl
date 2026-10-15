import { useAuthority, useRefusal } from '#/features/session';
import { useTenantDeletion } from '#/features/tenants/repository/useTenantDeletion';
import {
  DELETE_NEEDS,
  deleteConsequence,
  deleteFailure,
  deleteState,
  TENANTS_HREF,
  type DeleteState,
} from '#/features/tenants/service';
import { useGo } from '#/shared/repository/useGo';
import { useToast } from '#/shared/repository/useToasts';
import { lacking } from '#/shared/service/access';
import { deletedText } from '#/shared/service/failure';
import { SYSTEM_TENANT } from '#/shared/service/principal';
import { useConfirmedRemoval, type Removal } from '#/shared/usecase/useConfirmedChange';

export interface TenantDelete extends Removal {
  state: DeleteState;
  consequence: string;
}

// Leaves for the list once the tenant is gone: its record no longer exists.
export function useTenantDelete(name: string, enabled: boolean): TenantDelete {
  const refusal = useRefusal(SYSTEM_TENANT);
  const toast = useToast();
  const go = useGo();
  const missing = lacking(useAuthority(SYSTEM_TENANT), DELETE_NEEDS);
  const removal = useConfirmedRemoval({
    refusal,
    capability: 'manage-tenants',
    change: useTenantDeletion(name),
    failureText: (failure) => deleteFailure(name, failure),
    done: () => {
      toast.succeeded(deletedText(name));
      go(TENANTS_HREF, { replace: true });
    },
  });
  return {
    ...removal,
    state: deleteState({ name, enabled, missing }),
    consequence: deleteConsequence(name),
  };
}
