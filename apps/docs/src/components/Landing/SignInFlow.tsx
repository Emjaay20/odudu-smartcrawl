import Link from '@docusaurus/Link';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import Scene from '@site/src/components/Landing/Scene';
import { BEATS, travelKeyframes, type Step } from '@site/src/components/Landing/geometry';
import styles from '@site/src/components/Landing/flow.module.css';

const CLAIM_TEXT: Readonly<Record<string, string>> = {
  passwords: 'Passwords',
  passkeys: 'Passkeys',
  'authenticator-codes': 'Authenticator codes',
  'single-sign-on': 'Single sign-on across one tenant',
  'back-channel-logout': 'Back-channel logout',
};

const LAST = BEATS.length;
const REST_NOTE = 'Sign in once, and use every app of that tenant that trusts Odudu.';
const KEYFRAMES = travelKeyframes();

function stepOf(value: number): Step {
  return Math.min(Math.max(value, 0), LAST) as Step;
}

// Sign-in as one scene. With no script, or with reduced motion, it is the
// composed picture and the seven captions as a list. Otherwise it plays once
// when it scrolls into view, then rests; a stepper lets the reader jump to any
// beat, pause and play again.
export default function SignInFlow(): ReactElement {
  const uid = useId().replaceAll(':', '');
  const root = useRef<HTMLDivElement>(null);
  const chosen = useRef(false);
  const [interactive, setInteractive] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }
    setInteractive(true);
    const target = root.current;
    if (target === null) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (!chosen.current) {
          setStep(1);
          setPlaying(true);
        }
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || step === 0) return undefined;
    const timer = setTimeout(
      () => {
        if (step >= LAST) {
          setStep(0);
          setPlaying(false);
        } else {
          setStep(stepOf(step + 1));
        }
      },
      BEATS[step - 1]?.ms ?? 2000,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [playing, step]);

  const caption = step === 0 ? REST_NOTE : (BEATS[step - 1]?.caption ?? REST_NOTE);
  const toggleLabel = playing ? 'Pause' : step === 0 ? 'Play' : 'Resume';

  return (
    <div className={styles.flow} data-flow="" data-step={String(step)} ref={root}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div className={styles.stage}>
        <Scene layout="wide" step={step} uid={`${uid}-w`} />
        <Scene layout="tall" step={step} uid={`${uid}-t`} />
      </div>
      {interactive ? (
        <div className={styles.controls}>
          <div className={styles.stepper} role="group" aria-label="Steps">
            {BEATS.map((beat, index) => (
              <button
                key={beat.label}
                type="button"
                className={styles.stepButton}
                aria-current={step === index + 1 ? 'step' : undefined}
                onClick={() => {
                  chosen.current = true;
                  setStep(stepOf(index + 1));
                  setPlaying(false);
                }}
              >
                <span className={styles.stepNumber}>{String(index + 1)}</span>
                <span className={styles.stepLabel}>{beat.label}</span>
              </button>
            ))}
          </div>
          <div className={styles.transport}>
            <button
              type="button"
              className={styles.control}
              onClick={() => {
                chosen.current = true;
                if (playing) {
                  setPlaying(false);
                } else {
                  if (step === 0) setStep(1);
                  setPlaying(true);
                }
              }}
            >
              {toggleLabel}
            </button>
            <button
              type="button"
              className={styles.control}
              onClick={() => {
                chosen.current = true;
                setStep(1);
                setPlaying(true);
              }}
            >
              Replay
            </button>
          </div>
          <p className={styles.live} role="status" aria-live="polite">
            {step === 0 ? caption : `Step ${String(step)} of ${String(LAST)}: ${caption}`}
          </p>
        </div>
      ) : null}
      <ol className={styles.captions} data-flow-captions="" hidden={interactive}>
        {BEATS.map((beat) => (
          <li key={beat.label}>
            <p className={styles.caption}>{beat.caption}</p>
            {beat.claims.length === 0 ? null : (
              <ul className={styles.methods}>
                {beat.claims.map((claim) => (
                  <li key={claim} data-claim={claim}>
                    {CLAIM_TEXT[claim] ?? claim}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.more}>
        The ideas are in <Link to="/concepts/sessions/">Sessions</Link> and{' '}
        <Link to="/concepts/tokens/">Tokens</Link>, and{' '}
        <Link to="/guides/sign-a-user-in/">Sign a user in</Link> shows every request.
      </p>
    </div>
  );
}
