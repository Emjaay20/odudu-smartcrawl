import type { SigningKey, SigningKeyAlg } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { useKeyLane, type KeyLane } from '#/features/signing-keys/repository/useKeyLane';
import {
  useDeleteKey,
  usePromoteKey,
  useRetireKey,
  useStageKey,
} from '#/features/signing-keys/repository/useKeyWrites';
import {
  algOf,
  dialogOf,
  keyActionOutcome,
  promotionOf,
  promotionReading,
  type PromotionReading,
  stageFailure,
  stagedText,
  defaultAlg,
  type KeyAction,
} from '#/features/signing-keys/service';
import { useToast } from '#/shared/repository/useToasts';
import type { NamedDialog } from '#/shared/service/dialog';
import { useAnnouncedAction } from '#/shared/usecase/useAnnouncedAction';
import { useNow } from '#/shared/usecase/useNow';

// Finer than the minutes a key's readiness is measured in.
const CLOCK_MS = 30_000;

export interface KeyRow {
  key: SigningKey;
  // Only a rotating key can be promoted, and says whether it is ready.
  readiness: PromotionReading | null;
}

export interface Lane extends Omit<KeyLane, 'rows'> {
  rows: readonly KeyRow[];
}

export interface Asking {
  action: KeyAction;
  key: SigningKey;
  dialog: NamedDialog;
}

export interface SigningKeysPage {
  rotating: Lane;
  active: Lane;
  retired: Lane;
  alg: SigningKeyAlg;
  chooseAlg: (value: string) => void;
  staging: boolean;
  stage: () => void;
  stageMessage: string | null;
  asking: Asking | null;
  busy: boolean;
  problem: string | null;
  // What the last action came to, for the line beside the lanes.
  notice: string | null;
  // How many actions have ended in the key's new place, for a view that moves focus once the dialog is gone.
  acted: number;
  ask: (action: KeyAction, key: SigningKey) => void;
  cancel: () => void;
  confirm: () => Promise<boolean>;
}

export function useSigningKeysPage(tenant: string): SigningKeysPage {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const now = useNow(CLOCK_MS);
  const rotating = useKeyLane(tenant, 'rotating');
  const active = useKeyLane(tenant, 'active');
  const retired = useKeyLane(tenant, 'retired');
  const staging = useStageKey(tenant);
  const promote = usePromoteKey(tenant);
  const retire = useRetireKey(tenant);
  const remove = useDeleteKey(tenant);
  const [chosen, setChosen] = useState<SigningKeyAlg | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const writes = { promote: promote.run, retire: retire.run, delete: remove.run };
  const acting = useAnnouncedAction<{ action: KeyAction; key: SigningKey }>({
    refusal,
    capability: 'manage-keys',
    blocked: promote.busy || retire.busy || remove.busy,
    send: (asked) => writes[asked.action](asked.key.id),
    outcomeOf: (asked, result) => keyActionOutcome(asked.action, asked.key, result),
  });
  const current = active.rows[0];
  const alg = chosen ?? defaultAlg(current);
  const activeKnown = active.status === 'ready';
  const readiness = (key: SigningKey): PromotionReading =>
    promotionReading(promotionOf(key, active.rows, now, activeKnown));
  const laneOf = (lane: KeyLane, rotatingRows: boolean): Lane => ({
    ...lane,
    rows: lane.rows.map((key) => ({ key, readiness: rotatingRows ? readiness(key) : null })),
  });
  return {
    rotating: laneOf(rotating, true),
    active: laneOf(active, false),
    retired: laneOf(retired, false),
    alg,
    chooseAlg: (value) => {
      setChosen(algOf(value));
    },
    staging: staging.busy,
    stage: () => {
      setStageMessage(null);
      staging
        .run(alg)
        .then((result) => {
          if (result.ok) {
            toast.succeeded(stagedText(result.data));
            return;
          }
          const outcome = stageFailure(result);
          setStageMessage(outcome.message);
          if (outcome.report) refusal.report(result, 'manage-keys');
        })
        .catch(() => undefined);
    },
    stageMessage,
    asking:
      acting.asked === null
        ? null
        : {
            ...acting.asked,
            dialog: dialogOf(
              acting.asked.action,
              acting.asked.key,
              current,
              promotionOf(acting.asked.key, active.rows, now, activeKnown),
            ),
          },
    busy: promote.busy || retire.busy || remove.busy,
    problem: acting.problem,
    notice: acting.notice,
    acted: acting.done,
    ask: (action, key) => {
      acting.ask({ action, key });
    },
    cancel: acting.cancel,
    confirm: acting.confirm,
  };
}
