import manifest from '@site/static/console/manifest.json';

export interface ShotSize {
  readonly width: number;
  readonly height: number;
}

const SIZES: Readonly<Record<string, ShotSize>> = manifest;

// The captured size of a console picture, from the manifest the capture wrote.
export function sizeOf(name: string): ShotSize {
  const size = SIZES[name];
  if (size === undefined) throw new Error(`no console capture named ${name}`);
  return size;
}

export function captureAddress(name: string, scheme: 'light' | 'dark'): string {
  return `/console/${name}-${scheme}.webp`;
}
