import { RESTORE_CONFIRM_LABEL, RESTORE_DIALOG_TITLE } from '#/features/scopes/service';
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
        title={RESTORE_DIALOG_TITLE}
        consequence={restore.text}
        confirmLabel={RESTORE_CONFIRM_LABEL}
        tone="primary"
        held={restore.held}
        busy={restore.busy}
        problem={restore.problem}
        onConfirm={restore.confirm}
        onCancel={restore.cancel}
      />
    </>
  );
}
