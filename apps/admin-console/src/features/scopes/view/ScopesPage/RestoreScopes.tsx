import { useRestoreScopes } from '#/features/scopes/usecase/useRestoreScopes';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';

export function RestoreScopes({ tenant }: { tenant: string }) {
  const restore = useRestoreScopes(tenant);
  return (
    <>
      <Button onPress={restore.ask}>Restore built-in scopes</Button>
      <ConfirmDialog
        isOpen={restore.open}
        title="Restore built-in scopes?"
        consequence={restore.text}
        confirmLabel="Restore"
        tone="primary"
        settled={restore.settled}
        busy={restore.busy}
        problem={restore.problem}
        onConfirm={restore.confirm}
        onCancel={restore.cancel}
      />
    </>
  );
}
