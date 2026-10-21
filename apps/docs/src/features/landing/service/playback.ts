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

// The scene runs only while it is wanted, on screen and on a visible page.
export function isPlaying(wantsPlay: boolean, inView: boolean, pageShown: boolean): boolean {
  return wantsPlay && inView && pageShown;
}

export function captionOf(step: Step): string {
  return step === 0 ? REST_NOTE : (BEATS[step - 1]?.caption ?? REST_NOTE);
}

export function liveText(step: Step): string {
  const caption = captionOf(step);
  return step === 0 ? caption : `Step ${String(step)} of ${String(LAST)}: ${caption}`;
}

export function toggleLabel(playing: boolean): 'Pause' | 'Play' {
  return playing ? 'Pause' : 'Play';
}

// Where the scene starts: the first step, unless someone has chosen already.
export function startsOnEntry(chosen: boolean, started: boolean, reduced: boolean): boolean {
  return !chosen && !started && !reduced;
}
