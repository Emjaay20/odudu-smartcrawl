import type { ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import type { ThemeWrites } from '#/features/branding/repository/useThemeWrites';
import {
  NO_OUTCOME,
  publishFailure,
  publishHold,
  publishOutcomeOf,
  type PublishOutcome,
} from '#/features/branding/service';
import { useToast } from '#/shared/repository/useToasts';
import { failureOf } from '#/shared/service/settled';

export interface Publication {
  busy: boolean;
  // Why Publish is held, when it is.
  hold: string | undefined;
  outcome: PublishOutcome;
  publish: () => void;
}

export function usePublication({
  tenant,
  view,
  tag,
  unsaved,
  contrast,
  writes,
}: {
  tenant: string;
  view: ThemeView;
  tag: string;
  // The sections holding unsaved edits.
  unsaved: readonly string[];
  // Why the colours would be refused, from the pairs on screen.
  contrast: string | undefined;
  writes: ThemeWrites;
}): Publication {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const [outcome, setOutcome] = useState(NO_OUTCOME);
  const answered = (next: PublishOutcome): void => {
    setOutcome(next);
    if (next.toast !== null) toast.succeeded(next.toast);
  };
  return {
    busy: writes.publish.busy,
    hold: publishHold({ view, unsaved, contrast }),
    outcome,
    publish: () => {
      setOutcome(NO_OUTCOME);
      writes.publish
        .run(tag)
        .then((result) => {
          answered(publishOutcomeOf(result, publishFailure));
          const failure = failureOf(result);
          if (failure !== null) refusal.report(failure, 'manage-tenant');
        })
        .catch(() => {
          answered(publishOutcomeOf({ ok: false, kind: 'defect' }, publishFailure));
        });
    },
  };
}
