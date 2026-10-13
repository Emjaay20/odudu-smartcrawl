import { useRefusal } from '#/features/session';
import { changeFailureText } from '#/features/subjects/service';
import { useToasts } from '#/shared/repository/useToasts';
import type { Write } from '#/shared/repository/useWrite';
import type { AdminCapability } from '#/shared/service/principal';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useConfirmedChange, type Confirming } from '#/shared/usecase/useConfirmedChange';

// A change to a subject behind a plain confirmation, its success said in a toast.
export function useConfirmedSubjectChange<A, R>({
  tenant,
  capability,
  change,
  done,
}: {
  tenant: string;
  capability: AdminCapability;
  change: Write<A, GatewayResult<R>>;
  done: (arg: A, data: R) => string;
}): Confirming<A> {
  const refusal = useRefusal(tenant);
  const push = useToasts((queue) => queue.push);
  return useConfirmedChange({
    refusal,
    capability,
    change,
    failureText: (failure) => changeFailureText(failure, capability),
    done: (arg, data) => {
      push({ tone: 'success', message: done(arg, data) });
    },
  });
}
