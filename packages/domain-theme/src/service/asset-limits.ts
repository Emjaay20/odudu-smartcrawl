import { MAX_DECODED_PIXELS, type InspectLimits } from '#/service/image';

export type AssetKind = 'logo' | 'darkLogo' | 'favicon' | 'background';

export interface AssetLimits {
  // Applied to the upload and again to the re-encoded image.
  maxBytes: number;
  maxSide: number;
}

const SMALL: AssetLimits = { maxBytes: 256 * 1024, maxSide: 1024 };

export const ASSET_LIMITS: Record<AssetKind, AssetLimits> = {
  logo: SMALL,
  darkLogo: SMALL,
  favicon: SMALL,
  background: { maxBytes: 1024 * 1024, maxSide: 2560 },
};

// What one tenant's stored images may total (ADR 0046).
export const TENANT_ASSET_CAP_BYTES = 8 * 1024 * 1024;

export function inspectLimitsFor(kind: AssetKind): InspectLimits {
  return { maxPixels: MAX_DECODED_PIXELS, maxSide: ASSET_LIMITS[kind].maxSide };
}

export function withinByteLimit(kind: AssetKind, length: number): boolean {
  return length <= ASSET_LIMITS[kind].maxBytes;
}
