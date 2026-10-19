export type Scheme = 'light' | 'dark';

// What each part of a mail takes from the console's tokens. Mail clients read
// neither custom properties nor light-dark(), so the shell is drawn from hex
// compiled from tokens.css, and this is the only place that names which token
// colours which part.
export const MAIL_ROLES = {
  page: '--surface-page',
  panel: '--surface-panel',
  sunken: '--surface-sunken',
  border: '--border',
  ink: '--ink-primary',
  muted: '--ink-muted',
  link: '--signal-active-ink',
  button: '--ink-primary',
  buttonInk: '--surface-panel',
  rail: '--surface-rail',
  railInk: '--ink-rail',
  railEdge: '--ink-rail-muted',
} as const;

export type MailRole = keyof typeof MAIL_ROLES;
export type MailPalette = Readonly<Record<Scheme, Readonly<Record<MailRole, string>>>>;

const COLOUR_TOKEN = /^--(?:surface|ink|signal|border|focus|rail)(?:-|$)/u;
const LIGHT_DARK = /^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/iu;

// Every colour token is declared once as light-dark(#hex, #hex). A second
// declaration or another form is refused: the pair read here would no longer
// be the pair a browser draws.
export function readTokenPalette(css: string): Map<string, Record<Scheme, string>> {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const palette = new Map<string, Record<Scheme, string>>();
  for (const [, name = '', raw = ''] of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/giu)) {
    if (!COLOUR_TOKEN.test(name)) continue;
    const match = LIGHT_DARK.exec(raw.replace(/\s+/gu, ' ').trim());
    if (palette.has(name)) throw new Error(`${name}: declared more than once`);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`${name}: not light-dark(#hex, #hex): ${raw.trim()}`);
    }
    palette.set(name, { light: match[1].toLowerCase(), dark: match[2].toLowerCase() });
  }
  return palette;
}

export function mailPalette(css: string): MailPalette {
  const tokens = readTokenPalette(css);
  const pick = (scheme: Scheme): Record<MailRole, string> =>
    Object.fromEntries(
      Object.entries(MAIL_ROLES).map(([role, token]) => {
        const pair = tokens.get(token);
        if (pair === undefined) throw new Error(`${token}: not declared`);
        return [role, pair[scheme]];
      }),
    ) as Record<MailRole, string>;
  return { light: pick('light'), dark: pick('dark') };
}

function luminance(hex: string): number {
  const linear = (offset: number): number => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

// WCAG 2.2 contrast ratio between two #rrggbb colours.
export function contrastRatio(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
