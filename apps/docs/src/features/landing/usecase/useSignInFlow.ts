import { useEffect, useId, useReducer, useRef, type RefObject } from 'react';
import type { Step } from '@site/src/features/landing/service/geometry';
import {
  FLOW_START,
  flowReducer,
  playing,
  stepper,
  viewOf,
  waitFor,
  type StepperButton,
} from '@site/src/features/landing/service/playback';
import { usePrefersReducedMotion } from '@site/src/features/landing/usecase/usePrefersReducedMotion';
import { canObserve, watchVisible } from '@site/src/shared/platform/observe';
import { watchPageShown } from '@site/src/shared/platform/page';

export interface SignInFlow {
  uid: string;
  stage: RefObject<HTMLDivElement | null>;
  step: Step;
  wantsPlay: boolean;
  label: 'Pause' | 'Play';
  live: string;
  leaving: string;
  moved: boolean;
  holdMs: number;
  running: boolean;
  politeness: 'off' | 'polite';
  buttons: StepperButton[];
  choose: (step: Step) => void;
  toggle: () => void;
  replay: () => void;
}

// A margin as well as a share, so a short landscape screen still counts the scene as in view.
const IN_VIEW = { rootMargin: '20% 0px 20% 0px', threshold: 0.4 };

// Sign-in as one scene: it plays once when it comes into view, loops after a
// rest, and waits while it is off screen, the page is hidden, or a reader has
// taken over. Reduced motion never starts it, and a rest ends it.
export function useSignInFlow(): SignInFlow {
  const uid = useId().replaceAll(':', '');
  const stage = useRef<HTMLDivElement>(null);
  const [flow, dispatch] = useReducer(flowReducer, FLOW_START);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    dispatch({ type: 'motion', allowed: !reduced && canObserve() });
    const stopPage = watchPageShown((shown) => {
      dispatch({ type: 'page', shown });
    });
    const target = stage.current;
    const stopView =
      target === null
        ? undefined
        : watchVisible(target, IN_VIEW, (visible) => {
            dispatch({ type: 'view', visible });
          });
    return () => {
      stopPage();
      stopView?.();
    };
  }, [reduced]);

  const running = playing(flow);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setTimeout(() => {
      dispatch({ type: 'tick' });
    }, waitFor(flow.step));
    return () => {
      clearTimeout(timer);
    };
  }, [running, flow.step]);

  const view = viewOf(flow);
  return {
    uid,
    stage,
    step: flow.step,
    wantsPlay: flow.wantsPlay,
    label: view.label,
    live: view.live,
    leaving: view.leaving,
    moved: view.moved,
    holdMs: view.holdMs,
    running: view.running,
    politeness: view.politeness,
    buttons: stepper(flow.step),
    choose: (step) => {
      dispatch({ type: 'choose', step });
    },
    toggle: () => {
      dispatch({ type: 'toggle' });
    },
    replay: () => {
      dispatch({ type: 'replay' });
    },
  };
}
