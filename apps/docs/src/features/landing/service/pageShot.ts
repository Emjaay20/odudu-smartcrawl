import manifest from '@site/static/server-pages/manifest.json';

export interface PageShotSize {
  width: number;
  height: number;
}

const SIZES: Record<string, PageShotSize> = manifest;

export function pageShotSize(name: string): PageShotSize {
  const size = SIZES[name];
  if (size === undefined) throw new Error(`no server page capture named ${name}`);
  return size;
}

export function pageShotAddress(name: string, scheme: 'light' | 'dark'): string {
  return `/server-pages/${name}-${scheme}.webp`;
}
