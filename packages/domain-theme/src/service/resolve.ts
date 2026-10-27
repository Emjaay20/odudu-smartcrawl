import { PAGE_KINDS, type PageKind } from '@odudu/kernel';

import { type ThemeAssets, type ThemeBody, type TokenGroups } from '#/service/body';

const GROUPS = ['light', 'dark', 'font'] as const satisfies readonly (keyof TokenGroups)[];
const SLOTS = [
  'logo',
  'darkLogo',
  'favicon',
  'background',
] as const satisfies readonly (keyof ThemeAssets)[];
const KINDS = Object.keys(PAGE_KINDS) as PageKind[];

export type PieceName =
  | `tokens.${(typeof GROUPS)[number]}`
  | 'stylesheet'
  | `templates.${PageKind}`
  | `assets.${(typeof SLOTS)[number]}`;

export const PIECE_NAMES: readonly PieceName[] = [
  ...GROUPS.map((group): PieceName => `tokens.${group}`),
  'stylesheet',
  ...KINDS.map((kind): PieceName => `templates.${kind}`),
  ...SLOTS.map((slot): PieceName => `assets.${slot}`),
];

function has(body: ThemeBody, name: PieceName): boolean {
  if (name === 'stylesheet') return body.stylesheet !== null;
  const [section, key = ''] = name.split('.');
  if (section === 'tokens') return body.tokens[key as keyof TokenGroups] !== undefined;
  if (section === 'templates') return body.templates[key as PageKind] !== undefined;
  return body.assets[key as keyof ThemeAssets] !== undefined;
}

// Layers run most specific first. For each piece, the index of the first
// layer that holds it, or null when none does.
export function pieceSources(
  layers: readonly (ThemeBody | null)[],
): Record<PieceName, number | null> {
  const sources = {} as Record<PieceName, number | null>;
  for (const name of PIECE_NAMES) {
    const index = layers.findIndex((layer) => layer !== null && has(layer, name));
    sources[name] = index === -1 ? null : index;
  }
  return sources;
}

// Each piece comes whole from the first layer that has it: a palette group
// is never merged colour by colour, a template never line by line.
export function resolvePieces(layers: readonly (ThemeBody | null)[]): ThemeBody {
  const present = layers.filter((layer): layer is ThemeBody => layer !== null);
  const resolved: ThemeBody = { tokens: {}, stylesheet: null, templates: {}, assets: {} };
  for (const layer of present.toReversed()) {
    Object.assign(resolved.tokens, layer.tokens);
    Object.assign(resolved.templates, layer.templates);
    Object.assign(resolved.assets, layer.assets);
    if (layer.stylesheet !== null) resolved.stylesheet = layer.stylesheet;
  }
  return resolved;
}
