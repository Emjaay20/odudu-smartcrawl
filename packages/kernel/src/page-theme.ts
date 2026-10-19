// The console remembers a light or dark choice and writes it here, so the
// server-rendered pages, which run no script, can follow it. It is a
// preference: not a secret and not an identifier.
export const PAGE_THEME_COOKIE = 'odudu-theme';

export const PAGE_THEMES = ['light', 'dark'] as const;
export type PageTheme = (typeof PAGE_THEMES)[number];

export function isPageTheme(value: unknown): value is PageTheme {
  return value === 'light' || value === 'dark';
}

// Far above what a browser sends for the few cookies one origin holds, and
// far below what is worth parsing on a public page.
const MAX_COOKIE_HEADER = 8192;

function headerText(header: unknown): string | null {
  if (typeof header === 'string') return header;
  if (Array.isArray(header)) {
    return header.filter((entry): entry is string => typeof entry === 'string').join('; ');
  }
  return null;
}

// Exactly `light` or `dark`, from exactly one cookie of that name. Anything
// else, the name twice included, is no preference: a cookie planted beside
// ours cannot choose, and nothing but one of two constants is ever returned,
// so no part of the header reaches the markup.
export function pageThemeFromCookies(header: unknown): PageTheme | undefined {
  const text = headerText(header);
  if (text === null || text.length > MAX_COOKIE_HEADER) return undefined;
  const values: string[] = [];
  for (const pair of text.split(';')) {
    const at = pair.indexOf('=');
    if (at !== -1 && pair.slice(0, at).trim() === PAGE_THEME_COOKIE) {
      values.push(pair.slice(at + 1).trim());
    }
  }
  const [only] = values;
  return values.length === 1 && isPageTheme(only) ? only : undefined;
}
