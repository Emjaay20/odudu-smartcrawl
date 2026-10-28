import type { ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import type { ThemeWrites } from '#/features/branding/repository/useThemeWrites';
import {
  NO_OUTCOME,
  publishFailure,
  publishHold,
  publishOutcomeOf,
  PUBLISHED_TOAST,
  type PublishOutcome,
} from '#/features/branding/service';
import { useToast } from '#/shared/repository/useToasts';

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
  unsaved: boolean;
  // Why the colours would be refused, from the pairs on screen.
  contrast: string | undefined;
  writes: ThemeWrites;
}): Publication {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const [outcome, setOutcome] = useState(NO_OUTCOME);
  return {
    busy: writes.publish.busy,
    hold: publishHold({ view, unsaved, contrast }),
    outcome,
    publish: () => {
      if (writes.publish.busy) return;
      setOutcome(NO_OUTCOME);
      writes.publish
        .run(tag)
        .then((result) => {
          setOutcome(publishOutcomeOf(result, publishFailure));
          if (result.ok) toast.succeeded(PUBLISHED_TOAST);
          else refusal.report(result, 'manage-tenant');
        })
        .catch(() => {
          setOutcome(publishOutcomeOf({ ok: false, kind: 'defect' }, publishFailure));
        });
    },
  };
}
