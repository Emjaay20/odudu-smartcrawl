import type { GatewayFailure, GatewayResult } from '#/shared/service/result';
import {
  logoOf,
  uploadFailureText,
  UPLOAD_FAULT,
  UPLOAD_LOST,
} from '#/features/branding/service/assets';
import {
  colourProblem,
  DEFAULT_PALETTES,
  withColour,
  type Palette,
  type PaletteKey,
  type Scheme,
} from '#/features/branding/service/palette';
import {
  NO_ISSUES,
  issuesOf,
  warningLines,
  type Issues,
} from '#/features/branding/service/publish';
import type { PreviewChoice } from '#/features/branding/service/preview';
import {
  type ColourValues,
  type ImageSlot,
  type ImageValues,
  type Logo,
  type Plain,
} from '#/features/branding/service/values';
import type { PublishThemeResponse, ThemeView } from '@odudu/contracts/admin';

export function paletteField(scheme: Scheme): 'tokens.light' | 'tokens.dark' {
  return `tokens.${scheme}`;
}

// A scheme is Instrument's own, or a complete palette of the tenant's that
// starts from Instrument's colours.
export function customisedPalette(scheme: Scheme, custom: boolean): Palette | null {
  return custom ? DEFAULT_PALETTES[scheme] : null;
}

export function editedPalette(
  values: ColourValues,
  scheme: Scheme,
  key: PaletteKey,
  text: string,
): Palette {
  return withColour(values[paletteField(scheme)] ?? DEFAULT_PALETTES[scheme], key, text);
}

// The colour fields still not a finished #rrggbb, by palette key.
export function colourProblems(palette: Palette | null): Partial<Record<PaletteKey, string>> {
  if (palette === null) return {};
  return Object.fromEntries(
    (Object.keys(palette) as PaletteKey[])
      .map((key) => [key, colourProblem(palette[key])] as const)
      .filter(([, problem]) => problem !== undefined),
  );
}

export const COLOURS_HOLD = 'Finish each colour as #rrggbb before saving.';

export function coloursHold(values: ColourValues): string | undefined {
  const bad = (['light', 'dark'] as const).some(
    (scheme) => Object.keys(colourProblems(values[paletteField(scheme)])).length > 0,
  );
  return bad ? COLOURS_HOLD : undefined;
}

// What an uploaded image fills its slot with: a logo keeps the alt text it
// had, and starts without one.
export function imageAfterUpload(
  slot: ImageSlot,
  assetId: string,
  values: ImageValues,
): Logo | Plain {
  if (slot === 'logo') return logoOf(assetId, values['assets.logo']);
  if (slot === 'darkLogo') return logoOf(assetId, values['assets.darkLogo']);
  return { assetId };
}

export interface SlotState {
  busy: boolean;
  error: string | null;
}

export type SlotStates = Readonly<Record<ImageSlot, SlotState>>;

const QUIET: SlotState = { busy: false, error: null };

export const IDLE_SLOTS: SlotStates = {
  logo: QUIET,
  darkLogo: QUIET,
  favicon: QUIET,
  background: QUIET,
};

export function slotBusy(slots: SlotStates, slot: ImageSlot): SlotStates {
  return { ...slots, [slot]: { busy: true, error: null } };
}

export function slotFailed(slots: SlotStates, slot: ImageSlot, error: string): SlotStates {
  return { ...slots, [slot]: { busy: false, error } };
}

export function slotDone(slots: SlotStates, slot: ImageSlot): SlotStates {
  return { ...slots, [slot]: QUIET };
}

// What a failed upload says, in the console's words.
export function uploadFailureOf(slot: ImageSlot, failure: GatewayFailure): string {
  switch (failure.kind) {
    case 'problem':
      return uploadFailureText(slot, failure.problem);
    case 'network':
      return UPLOAD_LOST;
    default:
      return UPLOAD_FAULT;
  }
}

export interface PublishOutcome {
  issues: Issues;
  warnings: readonly string[];
  message: string | null;
}

export const NO_OUTCOME: PublishOutcome = { issues: NO_ISSUES, warnings: [], message: null };

export function publishOutcomeOf(
  result: GatewayResult<PublishThemeResponse>,
  failureText: (failure: GatewayFailure) => string,
): PublishOutcome {
  if (result.ok) return { issues: NO_ISSUES, warnings: warningLines(result.data), message: null };
  const errors = result.kind === 'problem' ? result.problem.errors : undefined;
  return { issues: issuesOf(errors), warnings: [], message: failureText(result) };
}

export function previewWith(choice: PreviewChoice, change: Partial<PreviewChoice>): PreviewChoice {
  return { ...choice, ...change };
}

// A frame reloads when what it shows may have changed: the published version,
// the draft, or what is asked of it.
export function previewKey(
  view: ThemeView | undefined,
  tag: string | null,
  choice: PreviewChoice,
): string {
  return `${String(view?.published?.version ?? 0)}|${tag ?? ''}|${choice.kind}|${choice.scheme}`;
}
