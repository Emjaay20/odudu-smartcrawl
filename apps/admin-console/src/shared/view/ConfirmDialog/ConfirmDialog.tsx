import { useId, useState, type SubmitEvent, type ReactNode } from 'react';
import { Button } from '#/shared/view/Button';
import { KeyHint } from '#/shared/view/KeyHint';
import { DialogFrame } from '#/shared/view/DialogFrame';
import { TextField } from '#/shared/view/Field';
import styles from '#/shared/view/ConfirmDialog/ConfirmDialog.module.css';

interface ConfirmProps {
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  // When set, confirm stays disabled until exactly this text is typed.
  typed?: string;
  busy?: boolean;
  // The server's refusal of the action, said where the action is.
  problem?: ReactNode;
  // Held when trying again could only be refused again.
  settled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ isOpen, ...props }: ConfirmProps & { isOpen: boolean }) {
  return isOpen ? <OpenConfirm {...props} /> : null;
}

// A confirmation a usecase has asked for, open while there is one. Danger
// unless the one asked says otherwise.
export function AskedDialog({
  asked,
  confirmLabel,
  busy,
  problem,
  onConfirm,
  onCancel,
}: {
  asked: {
    title: string;
    consequence: string;
    confirmLabel?: string;
    tone?: 'primary' | 'danger';
    typed?: string | null;
  } | null;
  // Where the action is named by the page, not by what was asked.
  confirmLabel?: string;
  busy?: boolean;
  problem?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      isOpen={asked !== null}
      title={asked?.title ?? ''}
      consequence={asked?.consequence ?? ''}
      confirmLabel={confirmLabel ?? asked?.confirmLabel ?? ''}
      tone={asked?.tone ?? 'danger'}
      {...(typeof asked?.typed === 'string' ? { typed: asked.typed } : {})}
      {...(busy === undefined ? {} : { busy })}
      {...(problem === undefined ? {} : { problem })}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function OpenConfirm({
  title,
  consequence,
  confirmLabel,
  tone = 'primary',
  typed,
  busy = false,
  problem,
  settled = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const shortcut = useId();
  const [entered, setEntered] = useState('');
  // Case counts; a space picked up by pasting the name does not.
  const ready = !busy && !settled && (typed === undefined || entered.trim() === typed);
  const confirm = (): void => {
    if (ready) onConfirm();
  };
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    confirm();
  };
  return (
    <DialogFrame
      isOpen
      role="alertdialog"
      title={title}
      description={consequence}
      {...(busy ? {} : { onEscape: onCancel })}
      actions={
        <>
          <Button
            isDisabled={busy}
            onPress={onCancel}
            {...(typed === undefined ? { autoFocus: true } : {})}
          >
            Cancel
          </Button>
          <Button
            variant={tone}
            isDisabled={!ready}
            onPress={confirm}
            {...(typed === undefined ? {} : { 'aria-describedby': shortcut })}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
          {typed === undefined ? null : (
            <span className={styles.shortcut}>
              <KeyHint id={shortcut} lead="or press" keys={['Enter']} />
            </span>
          )}
        </>
      }
    >
      {typed === undefined && problem === undefined ? undefined : (
        <>
          {typed === undefined ? null : (
            <form noValidate onSubmit={submit}>
              <TextField
                label={`Type ${typed} to confirm`}
                value={entered}
                onChange={setEntered}
                mono
                autoFocus
              />
            </form>
          )}
          {problem === undefined || problem === null ? null : (
            <p role="alert" className={styles.problem}>
              {problem}
            </p>
          )}
        </>
      )}
    </DialogFrame>
  );
}
