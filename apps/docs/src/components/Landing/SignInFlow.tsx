import Link from '@docusaurus/Link';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import FlowControls from '@site/src/components/Landing/FlowControls';
import Scene from '@site/src/components/Landing/Scene';
import { BEATS, type Step } from '@site/src/components/Landing/geometry';
import '@site/src/components/Landing/travel.css';
import styles from '@site/src/components/Landing/flow.module.css';

const CLAIM_TEXT: Readonly<Record<string, string>> = {
  passwords: 'Passwords',
  passkeys: 'Passkeys',
  'authenticator-codes': 'Authenticator codes',
  'single-sign-on': 'Single sign-on across one tenant',
  'back-channel-logout': 'Back-channel logout',
};

const LAST = BEATS.length;
const REST_MS = 3000;
const REST_NOTE = 'Sign in once, and use every app of that tenant that trusts Odudu.';

function stepOf(value: number): Step {
  return Math.min(Math.max(value, 0), LAST) as Step;
}

// Sign-in as one scene. With no script, or with reduced motion, it is the
// composed picture and the seven captions as a list. Otherwise it plays once
// when it comes into view, then rests; a stepper lets the reader jump to any
// beat, pause and play again.
export default function SignInFlow(): ReactElement {
  const uid = useId().replaceAll(':', '');
  const stage = useRef<HTMLDivElement>(null);
  const chosen = useRef(false);
  const motion = useRef(false);
  const [step, setStep] = useState<Step>(0);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageShown, setPageShown] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    motion.current = !reduced && typeof IntersectionObserver !== 'undefined';
    const onVisibility = (): void => {
      setPageShown(!document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const target = stage.current;
    let observer: IntersectionObserver | undefined;
    if (target !== null && typeof IntersectionObserver !== 'undefined') {
      let started = false;
      // A margin as well as a share, so a short landscape screen still counts the scene as in view.
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((entry) => entry.isIntersecting);
          setInView(visible);
          if (visible && !started && !chosen.current && !reduced) {
            started = true;
            setStep(1);
            setWantsPlay(true);
          }
        },
        { rootMargin: '20% 0px 20% 0px', threshold: 0.4 },
      );
      observer.observe(target);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, []);

  const playing = wantsPlay && inView && pageShown;

  useEffect(() => {
    if (!playing) return undefined;
    const wait = step === 0 ? REST_MS : (BEATS[step - 1]?.ms ?? 2000);
    const timer = setTimeout(() => {
      if (step === 0) {
        // Resting ends in a new round only where motion is welcome.
        if (motion.current) setStep(1);
        else setWantsPlay(false);
      } else {
        setStep(step >= LAST ? 0 : stepOf(step + 1));
      }
    }, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [playing, step]);

  const caption = step === 0 ? REST_NOTE : (BEATS[step - 1]?.caption ?? REST_NOTE);

  return (
    <div className={styles.flow} data-flow="" data-step={String(step)}>
      <div className={styles.stage} ref={stage}>
        <Scene layout="wide" step={step} uid={`${uid}-w`} />
        <Scene layout="tall" step={step} uid={`${uid}-t`} />
      </div>
      <div className={styles.below}>
        <FlowControls
          step={step}
          playing={wantsPlay}
          caption={caption}
          onChoose={(next) => {
            chosen.current = true;
            setStep(next);
            setWantsPlay(false);
          }}
          onToggle={() => {
            chosen.current = true;
            if (wantsPlay) {
              setWantsPlay(false);
            } else {
              if (step === 0) setStep(1);
              setWantsPlay(true);
            }
          }}
          onReplay={() => {
            chosen.current = true;
            setStep(1);
            setWantsPlay(true);
          }}
        />
        <ol className={styles.captions} data-flow-captions="">
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
      </div>
      <p className={styles.more}>
        The ideas are in <Link to="/concepts/sessions/">Sessions</Link> and{' '}
        <Link to="/concepts/tokens/">Tokens</Link>, and{' '}
        <Link to="/guides/sign-a-user-in/">Sign a user in</Link> shows every request.
      </p>
    </div>
  );
}
