import sharp from 'sharp';

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export type ImageRefusalCode =
  'unsupported_type' | 'animated' | 'corrupt' | 'empty' | 'too_many_pixels' | 'too_wide' | 'busy';

export interface ImageRefusal {
  kind: 'refused';
  code: ImageRefusalCode;
}

export interface InspectedImage {
  mime: ImageMime;
  width: number;
  height: number;
  bytes: Uint8Array;
}

export interface InspectLimits {
  maxPixels: number;
  // The longest side, in pixels.
  maxSide: number;
}

// Decoded pixels: RGBA at 4 bytes is 64 MB for one image in flight.
export const MAX_DECODED_PIXELS = 16_000_000;
export const MAX_IMAGE_SIDE = 2560;
// ADR 0041: at most this many decodes run at once, and at most this many more
// wait, so 100 simultaneous uploads hold two decoded images (about 128 MB)
// and the queued request bodies, never a hundred decodes.
export const MAX_CONCURRENT_INSPECTIONS = 2;
export const MAX_QUEUED_INSPECTIONS = 16;
// Encoder quality for the two lossy formats; the re-encode is deterministic.
const QUALITY = 90;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isImageRefusal(value: InspectedImage | ImageRefusal): value is ImageRefusal {
  return 'kind' in value;
}

function startsWith(bytes: Uint8Array, prefix: number[], at = 0): boolean {
  return prefix.every((byte, index) => bytes[at + index] === byte);
}

// The format is whatever the bytes are, never what the caller declared.
function sniff(bytes: Uint8Array): { format: 'png' | 'jpeg' | 'webp'; mime: ImageMime } | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return { format: 'png', mime: 'image/png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { format: 'jpeg', mime: 'image/jpeg' };
  const riff =
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  return riff ? { format: 'webp', mime: 'image/webp' } : null;
}

// An APNG is an ordinary PNG with an `acTL` chunk before the first `IDAT`;
// decoding it would silently keep only the first frame.
function isAnimatedPng(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += 12 + length;
  }
  return false;
}

async function inspect(
  bytes: Uint8Array,
  limits: InspectLimits,
): Promise<InspectedImage | ImageRefusal> {
  const kind = sniff(bytes);
  if (kind === null) return { kind: 'refused', code: 'unsupported_type' };
  if (kind.format === 'png' && isAnimatedPng(bytes)) return { kind: 'refused', code: 'animated' };
  try {
    // The header alone: the pixel limit is off here so an oversize image
    // reports its size instead of failing, and nothing is decoded.
    const header = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (header.format !== kind.format) return { kind: 'refused', code: 'unsupported_type' };
    if ((header.pages ?? 1) > 1) return { kind: 'refused', code: 'animated' };
    const { width, height } = header;
    if (!(width >= 1 && height >= 1)) {
      return { kind: 'refused', code: 'empty' };
    }
    if (width * height > limits.maxPixels) return { kind: 'refused', code: 'too_many_pixels' };
    if (Math.max(width, height) > limits.maxSide) return { kind: 'refused', code: 'too_wide' };
    // Orientation is applied, then dropped with every other tag: sharp keeps
    // no metadata unless asked, so EXIF, XMP, ICC and any trailer are gone.
    const pipeline = sharp(bytes, { limitInputPixels: limits.maxPixels, failOn: 'error' }).rotate();
    const encoded =
      kind.format === 'png'
        ? pipeline.png({ compressionLevel: 9 })
        : kind.format === 'jpeg'
          ? pipeline.jpeg({ quality: QUALITY })
          : pipeline.webp({ quality: QUALITY });
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    return { mime: kind.mime, width: info.width, height: info.height, bytes: data };
  } catch {
    return { kind: 'refused', code: 'corrupt' };
  }
}

export function createImageInspector(
  concurrency: number,
  queueLimit: number,
): (bytes: Uint8Array, limits?: InspectLimits) => Promise<InspectedImage | ImageRefusal> {
  let running = 0;
  const waiting: (() => void)[] = [];

  async function slot(): Promise<boolean> {
    if (running < concurrency) {
      running += 1;
      return true;
    }
    if (waiting.length >= queueLimit) return false;
    await new Promise<void>((resolve) => waiting.push(resolve));
    return true;
  }

  function release(): void {
    const next = waiting.shift();
    if (next === undefined) running -= 1;
    else next();
  }

  return async (bytes, limits = { maxPixels: MAX_DECODED_PIXELS, maxSide: MAX_IMAGE_SIDE }) => {
    if (!(await slot())) return { kind: 'refused', code: 'busy' };
    try {
      return await inspect(bytes, limits);
    } finally {
      release();
    }
  };
}

// libvips keeps decoded operations in a cache by default; uploads are never
// repeated, so it only holds memory.
sharp.cache(false);

export const inspectImage = createImageInspector(
  MAX_CONCURRENT_INSPECTIONS,
  MAX_QUEUED_INSPECTIONS,
);
