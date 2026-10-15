import { useAuthority, useRefusal } from '#/features/session';
import { useLockoutsClear } from '#/features/settings/repository/useLockoutsClear';
import {
  clearConsequence,
  clearedText,
  clearFailure,
  lockoutClearState,
  LOCKOUTS_NEEDS,
  type LockoutClearState,
} from '#/features/settings/service';
import { useToast } from '#/shared/repository/useToasts';
import { useConfirmedRemoval, type Removal } from '#/shared/usecase/useConfirmedChange';

export interface LockoutsClear extends Removal {
  state: LockoutClearState;
  consequence: string;
}

export function useLockoutsClearAction(tenant: string): LockoutsClear {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const removal = useConfirmedRemoval({
    refusal,
    capability: LOCKOUTS_NEEDS,
    change: useLockoutsClear(tenant),
    failureText: (failure) => clearFailure(tenant, failure),
    done: (answer) => {
      toast.succeeded(clearedText(tenant, answer));
    },
  });
  return {
    ...removal,
    state: lockoutClearState(useAuthority(tenant)),
    consequence: clearConsequence(tenant),
  };
}
