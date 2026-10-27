import { PAGE_KINDS, type PageKind } from '@odudu/kernel';
import { z } from 'zod';

// The families Instrument serves itself; a theme names one, never a URL.
export const FONT_CHOICES = ['IBM Plex Sans', 'IBM Plex Mono'] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export const MAX_TEMPLATE_BYTES = 64 * 1024;
export const MAX_STYLESHEET_BYTES = 128 * 1024;
export const MAX_ALT_LENGTH = 200;

const HEX_COLOUR = /^#[0-9a-f]{6}$/iu;

// Named after the custom properties the pages read. A group is complete or
// absent, so a client that overrides one replaces it whole.
export interface Palette {
  surfacePage: string;
  surfacePanel: string;
  inkPrimary: string;
  inkMuted: string;
  signalActive: string;
  signalActiveInk: string;
  borderStrong: string;
  focusRing: string;
}

export interface TokenGroups {
  light?: Palette | undefined;
  dark?: Palette | undefined;
  font?: FontChoice | undefined;
}

export interface LogoAsset {
  assetId: string;
  alt: string;
}

export interface ImageAsset {
  assetId: string;
}

export interface ThemeAssets {
  logo?: LogoAsset | undefined;
  darkLogo?: LogoAsset | undefined;
  favicon?: ImageAsset | undefined;
  background?: ImageAsset | undefined;
}

export interface ThemeBody {
  tokens: TokenGroups;
  stylesheet: string | null;
  templates: Partial<Record<PageKind, string>>;
  assets: ThemeAssets;
}

export type BodyIssueCode = 'type' | 'format' | 'required' | 'too_large' | 'unknown_key';

export interface BodyIssue {
  // A JSON pointer to the offending value; the empty string is the body.
  path: string;
  code: BodyIssueCode;
}

export type ParsedBody = { ok: true; body: ThemeBody } | { ok: false; issues: BodyIssue[] };

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

function boundedText(maxBytes: number): z.ZodType<string> {
  return z.string().superRefine((text, ctx) => {
    if (byteLength(text) > maxBytes) {
      ctx.addIssue({ code: 'too_big', origin: 'string', maximum: maxBytes, inclusive: true });
    }
  });
}

const colour = z
  .string()
  .regex(HEX_COLOUR)
  .transform((value) => value.toLowerCase());

const palette = z.strictObject({
  surfacePage: colour,
  surfacePanel: colour,
  inkPrimary: colour,
  inkMuted: colour,
  signalActive: colour,
  signalActiveInk: colour,
  borderStrong: colour,
  focusRing: colour,
});

const assetId = z.uuid();
const alt = z.string().min(1).max(MAX_ALT_LENGTH);

const pageKinds = Object.keys(PAGE_KINDS) as [PageKind, ...PageKind[]];

const bodySchema = z.strictObject({
  tokens: z
    .strictObject({
      light: palette.optional(),
      dark: palette.optional(),
      font: z.enum(FONT_CHOICES).optional(),
    })
    .default({}),
  stylesheet: boundedText(MAX_STYLESHEET_BYTES).nullable().default(null),
  templates: z.partialRecord(z.enum(pageKinds), boundedText(MAX_TEMPLATE_BYTES)).default({}),
  assets: z
    .strictObject({
      logo: z.strictObject({ assetId, alt }).optional(),
      darkLogo: z.strictObject({ assetId, alt }).optional(),
      favicon: z.strictObject({ assetId }).optional(),
      background: z.strictObject({ assetId }).optional(),
    })
    .default({}),
});

function codeOf(issue: z.core.$ZodIssue): BodyIssueCode {
  switch (issue.code) {
    case 'unrecognized_keys':
      return 'unknown_key';
    case 'too_big':
      return 'too_large';
    case 'too_small':
      return 'required';
    case 'invalid_format':
      return 'format';
    default:
      return 'type';
  }
}

const pointer = (segments: readonly PropertyKey[]): string =>
  segments.map((segment) => `/${String(segment)}`).join('');

function issuesOf(error: z.ZodError): BodyIssue[] {
  return error.issues.flatMap((issue) => {
    const code = codeOf(issue);
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ path: pointer([...issue.path, key]), code }));
    }
    if (issue.code === 'invalid_key') {
      return [
        {
          path: pointer([...issue.path, ...issue.issues.flatMap((inner) => inner.path)]),
          code: 'unknown_key' as const,
        },
      ];
    }
    return [{ path: pointer(issue.path), code }];
  });
}

export function parseThemeBody(input: unknown): ParsedBody {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return { ok: true, body: parsed.data };
}

// Every asset the body names, once each.
export function assetIdsOf(assets: ThemeAssets): string[] {
  const slots = [assets.logo, assets.darkLogo, assets.favicon, assets.background];
  return [...new Set(slots.flatMap((slot) => (slot === undefined ? [] : [slot.assetId])))];
}
