import type { ReactNode } from 'react';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';

// The foot of a record's General tab: what a delete takes with it, a danger
// button and the confirmation. `note` stands in for the button where the
// delete is not on offer or not yet known to be.
export function DeleteZone({
  name,
  deletion,
  consequence,
  typed,
  label,
  lead,
  note,
}: {
  name: string;
  deletion: {
    confirming: boolean;
    busy: boolean;
    problem: string | null;
    ask: () => void;
    cancel: () => void;
    confirm: () => void;
  };
  // What the dialog says is lost.
  consequence: ReactNode;
  // Held until this text is typed, where two records may share a name.
  typed?: string;
  // The button's text, where "Delete" and the name would say too little.
  label?: string;
  lead?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <Panel title="Delete">
      {lead}
      {note ?? (
        <div className={recordTab.actions}>
          <Button variant="danger" onPress={deletion.ask}>
            {label ?? `Delete ${name}`}
          </Button>
        </div>
      )}
      <ConfirmDialog
        isOpen={deletion.confirming}
        title={`Delete ${name}?`}
        consequence={consequence}
        confirmLabel={`Delete ${name}`}
        tone="danger"
        {...(typed === undefined ? {} : { typed })}
        busy={deletion.busy}
        problem={deletion.problem}
        onConfirm={deletion.confirm}
        onCancel={deletion.cancel}
      />
    </Panel>
  );
}
