import { CLEAR_HEADING, CLEAR_RULE, LOCKOUTS_NEEDS } from '#/features/settings/service';
import { useLockoutsClearAction } from '#/features/settings/usecase/useLockoutsClear';
import { Button } from '#/shared/view/Button';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';

export function ClearLockouts({ tenant }: { tenant: string }) {
  const clear = useLockoutsClearAction(tenant);
  if (clear.state === 'checking') return null;
  return (
    <Panel title={CLEAR_HEADING}>
      <p className={recordTab.rule}>{CLEAR_RULE}</p>
      {clear.state === 'lacking' ? (
        <CapabilityNote capability={LOCKOUTS_NEEDS}>Clearing every lockout</CapabilityNote>
      ) : (
        <>
          <div className={recordTab.actions}>
            <Button variant="danger" onPress={clear.ask}>
              {CLEAR_HEADING}
            </Button>
          </div>
          {clear.more === null ? null : <p role="status">{clear.more}</p>}
          <ConfirmDialog
            isOpen={clear.confirming}
            title={`${CLEAR_HEADING} in ${tenant}?`}
            consequence={clear.consequence}
            confirmLabel={CLEAR_HEADING}
            tone="danger"
            typed={tenant}
            busy={clear.busy}
            problem={clear.problem}
            onConfirm={clear.confirm}
            onCancel={clear.cancel}
          />
        </>
      )}
    </Panel>
  );
}
