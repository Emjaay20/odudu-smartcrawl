import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { useSmtpRemove } from '#/features/email/repository/useSmtpWrites';
import { removeOutcome } from '#/features/email/service';
import { useToasts } from '#/shared/repository/useToasts';

export interface RelayRemoval {
  confirming: boolean;
  busy: boolean;
  // What the last attempt said, shown where it was made.
  message: string | null;
  ask: () => void;
  cancel: () => void;
  confirm: () => void;
}

export function useRelayRemoval(tenant: string, reread: () => void): RelayRemoval {
  const remove = useSmtpRemove(tenant);
  const refusal = useRefusal(tenant);
  const push = useToasts((queue) => queue.push);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return {
    confirming,
    busy: remove.busy,
    message,
    ask: () => {
      setMessage(null);
      setConfirming(true);
    },
    cancel: () => {
      setConfirming(false);
    },
    confirm: () => {
      if (remove.busy) return;
      remove
        .run()
        .then((result) => {
          const outcome = removeOutcome(result);
          setConfirming(false);
          setMessage(outcome.text);
          if (!result.ok) refusal.report(result, 'manage-tenant');
          if (outcome.done) {
            push({ tone: 'success', message: outcome.text });
            reread();
          }
        })
        .catch(() => {
          setConfirming(false);
          setMessage(removeOutcome({ ok: false, kind: 'defect' }).text);
        });
    },
  };
}
