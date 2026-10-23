import { useBuiltinScopes, useRestoreBuiltins } from '#/features/scopes/repository/useScopeRecord';
import {
  restoredText,
  restoreFailureText,
  restoreHeld,
  restoreOffer,
  restoreText,
} from '#/features/scopes/service';
import { useRefusal } from '#/features/session';
import { useToast } from '#/shared/repository/useToasts';
import { useConfirmedRemoval } from '#/shared/usecase/useConfirmedChange';

export interface RestoreScopes {
  open: boolean;
  busy: boolean;
  problem: string | null;
  // What the dialog says: what is missing, or that nothing is.
  text: string;
  // False while nothing is known to be missing, so a press could only do nothing.
  settled: boolean;
  ask: () => void;
  cancel: () => void;
  confirm: () => void;
}

export function useRestoreScopes(tenant: string): RestoreScopes {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const restore = useRestoreBuiltins(tenant);
  const asking = useConfirmedRemoval({
    refusal,
    capability: 'manage-tenant',
    change: restore,
    failureText: restoreFailureText,
    done: (data) => {
      toast.succeeded(restoredText(data.created));
    },
  });
  const offer = restoreOffer(useBuiltinScopes(tenant, asking.confirming));
  return {
    open: asking.confirming,
    busy: asking.busy,
    problem: asking.problem,
    text: restoreText(offer),
    settled: restoreHeld(offer),
    ask: asking.ask,
    cancel: asking.cancel,
    confirm: asking.confirm,
  };
}
