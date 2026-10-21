import { claimText } from '@site/src/features/landing/service/content';
import { BEATS, type Step } from '@site/src/features/landing/service/geometry';

export const LAST = BEATS.length;
// How long the finished scene rests before it starts again.
export const REST_MS = 3000;
export const REST_NOTE = 'Sign in once, and use every app of that tenant that trusts Odudu.';

export function stepOf(value: number): Step {
  return Math.min(Math.max(value, 0), LAST) as Step;
}

// How long a step is shown: a beat of its own, or the rest after the last.
export function waitFor(step: Step): number {
  return step === 0 ? REST_MS : (BEATS[step - 1]?.ms ?? 2000);
}

export interface Advance {
  step: Step;
  // False where the round ends for good: a rest under reduced motion.
  keepPlaying: boolean;
}

export function advance(step: Step, motion: boolean): Advance {
  if (step === 0) return motion ? { step: 1, keepPlaying: true } : { step: 0, keepPlaying: false };
  return { step: step >= LAST ? 0 : stepOf(step + 1), keepPlaying: true };
}

export function captionOf(step: Step): string {
  return step === 0 ? REST_NOTE : (BEATS[step - 1]?.caption ?? REST_NOTE);
}

export function liveText(step: Step): string {
  const caption = captionOf(step);
  return step === 0 ? caption : `Step ${String(step)} of ${String(LAST)}: ${caption}`;
}

export interface Flow {
  step: Step;
  wantsPlay: boolean;
  inView: boolean;
  pageShown: boolean;
  // A reader has taken over: the scene never starts by itself after this.
  chosen: boolean;
  started: boolean;
  // Whether the scene may move on its own: motion is welcome and the browser can watch it.
  motion: boolean;
}

export type FlowEvent =
  | { type: 'motion'; allowed: boolean }
  | { type: 'view'; visible: boolean }
  | { type: 'page'; shown: boolean }
  | { type: 'tick' }
  | { type: 'choose'; step: Step }
  | { type: 'toggle' }
  | { type: 'replay' };

export const FLOW_START: Flow = {
  step: 0,
  wantsPlay: false,
  inView: false,
  pageShown: true,
  chosen: false,
  started: false,
  motion: false,
};

// The scene runs only while it is wanted, on screen and on a visible page.
export function playing(flow: Flow): boolean {
  return flow.wantsPlay && flow.inView && flow.pageShown;
}

export function flowReducer(flow: Flow, event: FlowEvent): Flow {
  switch (event.type) {
    case 'motion':
      return { ...flow, motion: event.allowed, started: false };
    case 'page':
      return { ...flow, pageShown: event.shown };
    case 'view': {
      const seen = { ...flow, inView: event.visible };
      const begins = event.visible && !flow.chosen && !flow.started && flow.motion;
      return begins ? { ...seen, started: true, step: 1, wantsPlay: true } : seen;
    }
    case 'tick': {
      const next = advance(flow.step, flow.motion);
      return { ...flow, step: next.step, wantsPlay: next.keepPlaying };
    }
    case 'choose':
      return { ...flow, chosen: true, step: event.step, wantsPlay: false };
    case 'toggle':
      if (flow.wantsPlay) return { ...flow, chosen: true, wantsPlay: false };
      return { ...flow, chosen: true, step: flow.step === 0 ? 1 : flow.step, wantsPlay: true };
    case 'replay':
      return { ...flow, chosen: true, step: 1, wantsPlay: true };
  }
}

export interface FlowView {
  caption: string;
  live: string;
  // What the Play/Pause button does when pressed.
  label: 'Pause' | 'Play';
  // Announcements wait while the scene plays on its own, so they do not talk over it.
  politeness: 'off' | 'polite';
}

export function viewOf(flow: Flow): FlowView {
  return {
    caption: captionOf(flow.step),
    live: liveText(flow.step),
    label: flow.wantsPlay ? 'Pause' : 'Play',
    politeness: flow.wantsPlay ? 'off' : 'polite',
  };
}

export interface StepperButton {
  step: Step;
  number: string;
  label: string;
  current: 'step' | undefined;
}

export function stepper(step: Step): StepperButton[] {
  return BEATS.map((beat, index) => {
    const own = stepOf(index + 1);
    return {
      step: own,
      number: String(own),
      label: beat.label,
      current: step === own ? 'step' : undefined,
    };
  });
}

export interface CaptionItem {
  label: string;
  caption: string;
  hasClaims: boolean;
  claims: { id: string; text: string }[];
}

// Each beat's caption and the sign-in methods it names, for the list shown without script.
export function captions(): CaptionItem[] {
  return BEATS.map((beat) => ({
    label: beat.label,
    caption: beat.caption,
    hasClaims: beat.claims.length > 0,
    claims: beat.claims.map((id) => ({ id, text: claimText(id) })),
  }));
}
