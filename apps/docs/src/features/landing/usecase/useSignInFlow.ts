import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { Step } from '@site/src/features/landing/service/geometry';
import {
  advance,
  captionOf,
  isPlaying,
  liveText,
  startsOnEntry,
  waitFor,
} from '@site/src/features/landing/service/playback';
import { usePrefersReducedMotion } from '@site/src/features/landing/usecase/usePrefersReducedMotion';

export interface SignInFlow {
  uid: string;
  stage: RefObject<HTMLDivElement | null>;
  step: Step;
  wantsPlay: boolean;
  caption: string;
  live: string;
  choose: (step: Step) => void;
  toggle: () => void;
  replay: () => void;
}

// Sign-in as one scene: it plays once when it comes into view, loops after a
// rest, and waits while it is off screen, the page is hidden, or a reader has
// taken over. Reduced motion never starts it, and a rest ends it.
export function useSignInFlow(): SignInFlow {
  const uid = useId().replaceAll(':', '');
  const stage = useRef<HTMLDivElement>(null);
  const chosen = useRef(false);
  const motion = useRef(false);
  const [step, setStep] = useState<Step>(0);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageShown, setPageShown] = useState(true);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
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
          if (visible && startsOnEntry(chosen.current, started, reduced)) {
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
  }, [reduced]);

  const playing = isPlaying(wantsPlay, inView, pageShown);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => {
      const next = advance(step, motion.current);
      setStep(next.step);
      if (!next.keepPlaying) setWantsPlay(false);
    }, waitFor(step));
    return () => {
      clearTimeout(timer);
    };
  }, [playing, step]);

  return {
    uid,
    stage,
    step,
    wantsPlay,
    caption: captionOf(step),
    live: liveText(step),
    choose: (next) => {
      chosen.current = true;
      setStep(next);
      setWantsPlay(false);
    },
    toggle: () => {
      chosen.current = true;
      if (wantsPlay) {
        setWantsPlay(false);
        return;
      }
      if (step === 0) setStep(1);
      setWantsPlay(true);
    },
    replay: () => {
      chosen.current = true;
      setStep(1);
      setWantsPlay(true);
    },
  };
}
