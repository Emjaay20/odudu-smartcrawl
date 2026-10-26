import { Prism, type PrismTheme } from 'prism-react-renderer';

// One piece of a highlighted line: plain text, or the token classes and the text.
export type Piece = string | [classes: string, text: string];
export type Lines = Piece[][];

interface Node {
  type: string;
  lang?: string | null;
  value?: string;
  children?: Node[];
  data?: { hProperties?: Record<string, unknown> };
}

type Tree = string | { type: string; alias?: string | string[]; content: unknown };

export const TOKENS_ATTRIBUTE = 'data-tokens';

function aliases(token: { type: string; alias?: string | string[] }): string[] {
  const alias = token.alias === undefined ? [] : [token.alias].flat();
  return [token.type, ...alias];
}

function flatten(tree: Tree[], inherited: string[]): [string, string][] {
  return tree.flatMap((part): [string, string][] => {
    if (typeof part === 'string') return [[inherited.join(' '), part]];
    const own = [...inherited, ...aliases(part)];
    return Array.isArray(part.content)
      ? flatten(part.content as Tree[], own)
      : [[own.join(' '), String(part.content)]];
  });
}

// The lines of `code` as the highlighter splits them, or nothing when the
// language has no grammar, in which case the page shows the code as plain text.
export function tokenize(code: string, language: string | null | undefined): Lines | undefined {
  const name = language?.toLowerCase();
  if (name === undefined || !Object.hasOwn(Prism.languages, name)) return undefined;
  const grammar = Prism.languages[name];
  if (grammar === undefined) return undefined;
  const lines: Piece[][] = [[]];
  for (const [classes, text] of flatten(Prism.tokenize(code, grammar), [])) {
    text.split('\n').forEach((chunk, index) => {
      if (index > 0) lines.push([]);
      if (chunk === '') return;
      lines[lines.length - 1]?.push(classes === '' ? chunk : [classes, chunk]);
    });
  }
  return lines;
}

function visit(node: Node, found: Node[]): Node[] {
  if (node.type === 'code') found.push(node);
  for (const child of node.children ?? []) visit(child, found);
  return found;
}

// A fenced block carries its highlighted lines to the page as an attribute, so
// the browser never loads a tokenizer to show them.
export default function codeTokens(): (tree: Node) => void {
  return (tree) => {
    for (const block of visit(tree, [])) {
      const lines = tokenize(block.value ?? '', block.lang);
      if (lines === undefined) continue;
      block.data = {
        ...block.data,
        hProperties: { ...block.data?.hProperties, [TOKENS_ATTRIBUTE]: JSON.stringify(lines) },
      };
    }
  };
}

const READABLE = 4.5;
const LIGHT_SURFACE = '#f6f8fa';
const DARK_SURFACE = '#282a36';
// Comments are set quiet on purpose by both themes.
const QUIET = new Set(['comment', 'prolog', 'doctype', 'cdata']);

function channels(color: string): [number, number, number] {
  const rgb = /^rgb\((\d+), (\d+), (\d+)\)$/u.exec(color);
  if (rgb !== null) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.replace(/./gu, (c) => c + c) : hex;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as [number, number, number];
}

function luminance(color: string): number {
  const [r, g, b] = channels(color).map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

function hex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

// A theme colour moved toward the mode's text colour until it reads on the surface.
function legible(color: string, surface: string, toward: number): string {
  let current = channels(color);
  for (let step = 0; step < 40 && contrast(hex(current), surface) < READABLE; step += 1) {
    current = current.map((c) => c + (toward - c) * 0.05) as [number, number, number];
  }
  return hex(current);
}

function declarations(
  style: Record<string, unknown>,
  surface: string,
  toward: number,
  quiet: boolean,
): string {
  return Object.entries(style)
    .map(([name, value]) => {
      const written =
        name === 'color' && !quiet ? legible(String(value), surface, toward) : String(value);
      return `${name.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}: ${written};`;
    })
    .join(' ');
}

interface Mode {
  theme: PrismTheme;
  scope: string;
  surface: string;
  toward: number;
}

function tokenRules({ theme, scope, surface, toward }: Mode): string[] {
  return theme.styles.map(({ types, style }) => {
    const selector = types.map((type) => `${scope}.tok-${type}`).join(', ');
    const quiet = types.every((type) => QUIET.has(type));
    return `${selector} { ${declarations(style, surface, toward, quiet)} }`;
  });
}

function blockRule({ theme, scope, surface, toward }: Mode): string {
  return `${scope}.theme-code-block pre { color: ${legible(String(theme.plain.color), surface, toward)}; }`;
}

// The colours of a Prism theme as rules on `.tok-*` classes. Each mode's rules
// are scoped to it, so a type one theme names and the other does not takes the
// block's colour rather than the other mode's, and every colour is moved until
// it reads on the surface.
export function themeCss(light: PrismTheme, dark: PrismTheme): string {
  const modes: Mode[] = [
    { theme: light, scope: ":root:not([data-theme='dark']) ", surface: LIGHT_SURFACE, toward: 0 },
    { theme: dark, scope: "[data-theme='dark'] ", surface: DARK_SURFACE, toward: 255 },
  ];
  return [
    '/* Written from the two Prism themes by themeCss in plugins/code-tokens.ts. */',
    ...modes.flatMap((mode) => [blockRule(mode), ...tokenRules(mode)]),
    '',
  ].join('\n');
}
