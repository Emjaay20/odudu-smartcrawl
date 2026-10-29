import type { ThemeView } from '@odudu/contracts/admin';
import { useRefusal } from '#/features/session';
import type { ThemeWrites } from '#/features/branding/repository/useThemeWrites';
import {
  publishFailure,
  publishHold,
  publishOutcomeOf,
  NO_OUTCOME,
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
  outcome,
  onOutcome,
}: {
  tenant: string;
  view: ThemeView;
  tag: string;
  // The sections holding unsaved edits.
  unsaved: readonly string[];
  // Why the colours would be refused, from the pairs on screen.
  contrast: string | undefined;
  writes: ThemeWrites;
  // The last answer, held by the page so every tab can mark what it refused.
  outcome: PublishOutcome;
  onOutcome: (outcome: PublishOutcome) => void;
}): Publication {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const answered = (next: PublishOutcome): void => {
    onOutcome(next);
    if (next.toast !== null) toast.succeeded(next.toast);
  };
  return {
    busy: writes.publish.busy,
    hold: publishHold({ view, unsaved, contrast }),
    outcome,
    publish: () => {
      onOutcome(NO_OUTCOME);
      writes.publish
        .run(tag)
        .then((result) => {
          answered(publishOutcomeOf(result, publishFailure, tag));
          const failure = failureOf(result);
          if (failure !== null) refusal.report(failure, 'manage-tenant');
        })
        .catch(() => {
          answered(publishOutcomeOf({ ok: false, kind: 'defect' }, publishFailure, tag));
        });
    },
  };
}
