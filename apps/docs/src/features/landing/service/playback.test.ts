import { describe, expect, it } from 'vitest';
import { BEATS } from '@site/src/features/landing/service/geometry';
import {
  LAST,
  REST_MS,
  REST_NOTE,
  advance,
  captionOf,
  isPlaying,
  liveText,
  startsOnEntry,
  stepOf,
  toggleLabel,
  waitFor,
} from '@site/src/features/landing/service/playback';

describe('the sign-in scene playback', () => {
  it('clamps a step into the scene, with 0 as rest', () => {
    expect([stepOf(-3), stepOf(0), stepOf(4), stepOf(99)]).toEqual([0, 0, 4, LAST]);
  });

  it('shows each beat for its own time and the rest for three seconds', () => {
    expect(waitFor(0)).toBe(REST_MS);
    expect(REST_MS).toBe(3000);
    BEATS.forEach((beat, index) => {
      expect(waitFor(stepOf(index + 1))).toBe(beat.ms);
    });
  });

  it('goes through every step in order, rests after the last and starts again', () => {
    const seen = [1, 2, 3, 4, 5, 6, 7].map((step) => advance(stepOf(step), true).step);
    expect(seen).toEqual([2, 3, 4, 5, 6, 7, 0]);
    expect(advance(0, true)).toEqual({ step: 1, keepPlaying: true });
  });

  it('ends a round at the rest where motion is not welcome', () => {
    expect(advance(0, false)).toEqual({ step: 0, keepPlaying: false });
    expect(advance(3, false)).toEqual({ step: 4, keepPlaying: true });
  });

  it('plays only while wanted, on screen and on a shown page', () => {
    expect(isPlaying(true, true, true)).toBe(true);
    expect(isPlaying(false, true, true)).toBe(false);
    expect(isPlaying(true, false, true)).toBe(false);
    expect(isPlaying(true, true, false)).toBe(false);
  });

  it('starts on entry once, unless a reader has chosen or motion is reduced', () => {
    expect(startsOnEntry(false, false, false)).toBe(true);
    expect(startsOnEntry(true, false, false)).toBe(false);
    expect(startsOnEntry(false, true, false)).toBe(false);
    expect(startsOnEntry(false, false, true)).toBe(false);
  });

  it('words the caption and the announcement, and the toggle by its action', () => {
    expect(captionOf(0)).toBe(REST_NOTE);
    expect(captionOf(1)).toBe(BEATS[0]?.caption);
    expect(liveText(0)).toBe(REST_NOTE);
    expect(liveText(3)).toBe(`Step 3 of 7: ${BEATS[2]?.caption ?? ''}`);
    expect(toggleLabel(true)).toBe('Pause');
    expect(toggleLabel(false)).toBe('Play');
  });
});
