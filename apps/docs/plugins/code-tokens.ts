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
  const grammar =
    language === null || language === undefined ? undefined : Prism.languages[language];
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

function declarations(style: Record<string, unknown>): string {
  return Object.entries(style)
    .map(
      ([name, value]) =>
        `${name.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}: ${String(value)};`,
    )
    .join(' ');
}

function tokenRules(theme: PrismTheme, scope: string): string[] {
  return theme.styles.map(({ types, style }) => {
    const selector = types.map((type) => `${scope}.tok-${type}`).join(', ');
    return `${selector} { ${declarations(style)} }`;
  });
}

function blockRule(theme: PrismTheme, scope: string): string {
  return `${scope}.theme-code-block pre { color: ${String(theme.plain.color)}; }`;
}

// The colours of a Prism theme as rules on `.tok-*` classes: the light theme
// everywhere, the dark one under `[data-theme='dark']`.
export function themeCss(light: PrismTheme, dark: PrismTheme): string {
  const darkScope = "[data-theme='dark'] ";
  return [
    '/* Written from the two Prism themes by themeCss in plugins/code-tokens.ts. */',
    blockRule(light, ''),
    ...tokenRules(light, ''),
    blockRule(dark, darkScope),
    ...tokenRules(dark, darkScope),
    '',
  ].join('\n');
}
