import { assetIdsOf, assetPath, type PublishedLayer, type ThemeRecord } from '@odudu/domain-theme';

export interface WeighedImage {
  readonly id: string;
  readonly sha256: string;
  readonly mime: string;
  readonly size: number;
}

// The ids of every image the layers name, once each.
export function imageIdsOf(records: readonly ThemeRecord[]): string[] {
  return [...new Set(records.flatMap((record) => assetIdsOf(record.body.assets)))];
}

// A stored theme as the renderer's own reader takes it, with the images it
// names that exist. A draft has no version and is no published layer, but the
// builder reads both the same way.
export function layerOf(record: ThemeRecord, images: readonly WeighedImage[]): PublishedLayer {
  const named = new Set(assetIdsOf(record.body.assets));
  return {
    versionId: record.id,
    clientId: record.scope.clientId,
    version: record.version,
    body: record.body,
    assets: images
      .filter((image) => named.has(image.id))
      .map(({ id, sha256, mime }) => ({ id, sha256, mime })),
  };
}

// The characters a `data:` URI spends on `size` bytes.
export function base64Length(size: number): number {
  return 4 * Math.ceil(size / 3);
}

export interface UsedImage {
  readonly id: string;
  readonly path: string;
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

// The images whose public path the page or its stylesheet actually holds:
// only those are inlined. Each occurrence is replaced by the whole data
// address, so the weight is the base64 length times every occurrence in the
// page and the stylesheet, which is what the inlined output grows by.
export function usedImages(
  tenantName: string,
  images: readonly WeighedImage[],
  texts: readonly string[],
): { used: UsedImage[]; weight: number } {
  const used: UsedImage[] = [];
  let weight = 0;
  for (const image of images) {
    const path = assetPath(tenantName, image.sha256, image.mime);
    if (path === null) continue;
    const count = texts.reduce((total, text) => total + occurrences(text, path), 0);
    if (count === 0) continue;
    used.push({ id: image.id, path });
    weight += base64Length(image.size) * count;
  }
  return { used, weight };
}

export function dataUri(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}
