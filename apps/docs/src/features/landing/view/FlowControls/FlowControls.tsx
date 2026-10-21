import type { ReactElement } from 'react';
import type { Step } from '@site/src/features/landing/service/geometry';
import type { StepperButton } from '@site/src/features/landing/service/playback';
import styles from '@site/src/features/landing/view/FlowControls/FlowControls.module.css';

interface Props {
  buttons: StepperButton[];
  playing: boolean;
  label: 'Pause' | 'Play';
  live: string;
  politeness: 'off' | 'polite';
  onChoose: (step: Step) => void;
  onToggle: () => void;
  onReplay: () => void;
}

// Pause and Replay first, then the seven steps, then what the current step says.
export function FlowControls({
  buttons,
  playing,
  label,
  live,
  politeness,
  onChoose,
  onToggle,
  onReplay,
}: Props): ReactElement {
  return (
    <div className={styles.controls}>
      <div className={styles.controlRow}>
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.control}
            aria-pressed={playing}
            aria-label={`${label} autoplay`}
            onClick={onToggle}
          >
            {label}
          </button>
          <button type="button" className={styles.control} onClick={onReplay}>
            Replay
          </button>
        </div>
        <div className={styles.stepper} role="group" aria-label="Steps">
          {buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              className={styles.stepButton}
              aria-current={button.current}
              onClick={() => {
                onChoose(button.step);
              }}
            >
              <span className={styles.stepNumber}>{button.number}</span>
              <span className={styles.stepLabel}>{button.label}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={styles.live} role="status" aria-live={politeness}>
        {live}
      </p>
    </div>
  );
}
