import { createRequire } from 'node:module';

type Palette = number[][];
interface Gifenc {
  GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: Palette; delay?: number; repeat?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette;
  applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array;
}

// gifenc is CommonJS with no types: Node sees named exports only through require.
const loaded: unknown = createRequire(import.meta.url)('gifenc');
const gifenc = loaded as Gifenc;

export interface RawFrame {
  readonly rgba: Uint8ClampedArray;
  readonly delayMs: number;
}

const COLOURS = 128;
// Every Nth pixel of every frame is enough to choose the palette of a flat interface.
const SAMPLE_STRIDE = 7;

function sampleOf(frames: readonly RawFrame[]): Uint8ClampedArray {
  const picked: number[] = [];
  for (const { rgba } of frames) {
    for (let pixel = 0; pixel < rgba.length / 4; pixel += SAMPLE_STRIDE) {
      picked.push(rgba[pixel * 4] ?? 0, rgba[pixel * 4 + 1] ?? 0, rgba[pixel * 4 + 2] ?? 0, 255);
    }
  }
  return Uint8ClampedArray.from(picked);
}

/**
 * One palette for the whole animation, so a colour never shifts between
 * frames, and a loop that runs forever.
 */
export function encodeGif(frames: readonly RawFrame[], width: number, height: number): Uint8Array {
  if (frames.length === 0) throw new Error('no frames to encode');
  frames.forEach(({ rgba }, index) => {
    if (rgba.length !== width * height * 4) {
      throw new Error(`frame ${String(index + 1)} is not ${String(width)} x ${String(height)}`);
    }
  });
  const palette = gifenc.quantize(sampleOf(frames), COLOURS);
  const encoder = gifenc.GIFEncoder();
  frames.forEach(({ rgba, delayMs }, index) => {
    encoder.writeFrame(gifenc.applyPalette(rgba, palette), width, height, {
      delay: delayMs,
      repeat: 0,
      ...(index === 0 ? { palette } : {}),
    });
  });
  encoder.finish();
  return encoder.bytes();
}
