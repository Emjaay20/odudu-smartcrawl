import { describe, expect, it } from 'vitest';
import { encodeGif, type RawFrame } from './gif-encode.ts';

const WIDTH = 24;
const HEIGHT = 16;

function flat(red: number, green: number, blue: number, delayMs: number): RawFrame {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    rgba.set([red, green, blue, 255], pixel * 4);
  }
  return { rgba, delayMs };
}

function delays(gif: Uint8Array): number[] {
  const found: number[] = [];
  for (let at = 0; at + 7 < gif.length; at += 1) {
    if (gif[at] === 0x21 && gif[at + 1] === 0xf9 && gif[at + 2] === 4 && gif[at + 7] === 0) {
      found.push(((gif[at + 5] ?? 0) << 8) | (gif[at + 4] ?? 0));
    }
  }
  return found;
}

describe('encodeGif', () => {
  const frames = [flat(10, 20, 30, 500), flat(200, 100, 50, 1200), flat(10, 20, 30, 80)];
  const gif = encodeGif(frames, WIDTH, HEIGHT);

  it('writes a GIF89a of the given size', () => {
    expect(new TextDecoder().decode(gif.slice(0, 6))).toBe('GIF89a');
    const view = new DataView(gif.buffer, gif.byteOffset);
    expect(view.getUint16(6, true)).toBe(WIDTH);
    expect(view.getUint16(8, true)).toBe(HEIGHT);
    expect(gif.at(-1)).toBe(0x3b);
  });

  it('loops forever', () => {
    const text = new TextDecoder('latin1').decode(gif);
    expect(text).toContain('NETSCAPE2.0');
    const at = text.indexOf('NETSCAPE2.0');
    expect(gif.slice(at + 11, at + 16)).toEqual(new Uint8Array([3, 1, 0, 0, 0]));
  });

  it('keeps each frame and its hold, in hundredths of a second', () => {
    expect(delays(gif)).toEqual([50, 120, 8]);
  });

  it('refuses a frame of the wrong size', () => {
    expect(() =>
      encodeGif([{ rgba: new Uint8ClampedArray(4), delayMs: 100 }], WIDTH, HEIGHT),
    ).toThrow(/frame 1/u);
  });

  it('refuses no frames', () => {
    expect(() => encodeGif([], WIDTH, HEIGHT)).toThrow(/no frames/u);
  });
});
