import type { ReactElement } from 'react';
import { BEATS, type Step } from '@site/src/components/Landing/geometry';
import styles from '@site/src/components/Landing/flow.module.css';

interface Props {
  readonly step: Step;
  readonly playing: boolean;
  readonly caption: string;
  readonly onChoose: (step: Step) => void;
  readonly onToggle: () => void;
  readonly onReplay: () => void;
}

// The part of the sign-in scene that only matters once a reader reaches for
// it, so it is fetched after the page has loaded.
export default function FlowControls({
  step,
  playing,
  caption,
  onChoose,
  onToggle,
  onReplay,
}: Props): ReactElement {
  const toggleLabel = playing ? 'Pause' : 'Play';
  return (
    <div className={styles.controls}>
      <div className={styles.controlRow}>
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.control}
            aria-pressed={playing}
            aria-label={`${toggleLabel} autoplay`}
            onClick={onToggle}
          >
            {toggleLabel}
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
        {step === 0 ? caption : `Step ${String(step)} of ${String(BEATS.length)}: ${caption}`}
      </p>
    </div>
  );
}
