import { createHash } from 'node:crypto';

export interface InstrumentSources {
  readonly tokensCss: string;
  readonly fontsCss: string;
  readonly pagesCss: string;
  // The bytes of a font, by the path its `url()` carries in `fontsCss`.
  readonly fontFile: (name: string) => Buffer;
}

export interface InstrumentBuild {
  readonly css: string;
  // Keyed by the `<name>.<hash>.woff2` the stylesheet links, under
  // `/instrument/fonts/`.
  readonly fonts: ReadonlyMap<string, Buffer>;
}

const FONT_URL = /url\('(@fontsource\/[^']+\/files\/([^'/]+)\.woff2)'\)/gu;
const HASH_LENGTH = 8;

// The hash is of the bytes, so a font keeps its URL until it changes and the
// served copy can be cached for a year.
export function buildInstrument(sources: InstrumentSources): InstrumentBuild {
  const fonts = new Map<string, Buffer>();
  const fontsCss = sources.fontsCss.replace(FONT_URL, (_match, path: string, name: string) => {
    const bytes = sources.fontFile(path);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, HASH_LENGTH);
    const file = `${name}.${hash}.woff2`;
    fonts.set(file, bytes);
    return `url('/instrument/fonts/${file}')`;
  });
  return {
    css: [sources.tokensCss, fontsCss, sources.pagesCss].join('\n'),
    fonts,
  };
}
