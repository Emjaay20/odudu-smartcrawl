import type { ReactElement } from 'react';
import { BEATS, type Step } from '@site/src/features/landing/service/geometry';
import { toggleLabel } from '@site/src/features/landing/service/playback';
import styles from '@site/src/features/landing/view/FlowControls/FlowControls.module.css';

interface Props {
  readonly step: Step;
  readonly playing: boolean;
  readonly live: string;
  readonly onChoose: (step: Step) => void;
  readonly onToggle: () => void;
  readonly onReplay: () => void;
}

// Pause and Replay first, then the seven steps, then what the current step says.
export function FlowControls({
  step,
  playing,
  live,
  onChoose,
  onToggle,
  onReplay,
}: Props): ReactElement {
  const label = toggleLabel(playing);
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
          {BEATS.map((beat, index) => (
            <button
              key={beat.label}
              type="button"
              className={styles.stepButton}
              aria-current={step === index + 1 ? 'step' : undefined}
              onClick={() => {
                onChoose((index + 1) as Step);
              }}
            >
              <span className={styles.stepNumber}>{String(index + 1)}</span>
              <span className={styles.stepLabel}>{beat.label}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={styles.live} role="status" aria-live={playing ? 'off' : 'polite'}>
        {live}
      </p>
    </div>
  );
}
