import type { GatewayFailure, GatewayResult } from '#/shared/service/result';
import {
  logoOf,
  uploadRefusal,
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
  PUBLISHED_TOAST,
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
import type {
  FieldError,
  PublishThemeResponse,
  ThemeAsset,
  ThemeView,
} from '@odudu/contracts/admin';
import { tabNamed } from '#/shared/service/record';
import { OFFERED_TABS, type OfferedTab } from '#/features/branding/service/tabs';

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
  // The refusals as the server gave them, with their lines, and the draft
  // they were given for.
  errors: readonly FieldError[];
  atTag: string | null;
  warnings: readonly string[];
  message: string | null;
  // Said as a toast once the publish went through.
  toast: string | null;
}

export const NO_OUTCOME: PublishOutcome = {
  issues: NO_ISSUES,
  errors: [],
  atTag: null,
  warnings: [],
  message: null,
  toast: null,
};

export function publishOutcomeOf(
  result: GatewayResult<PublishThemeResponse>,
  failureText: (failure: GatewayFailure) => string,
  tag: string,
): PublishOutcome {
  if (result.ok) {
    return {
      issues: NO_ISSUES,
      errors: [],
      atTag: null,
      warnings: warningLines(result.data),
      message: null,
      toast: PUBLISHED_TOAST,
    };
  }
  const errors = result.kind === 'problem' ? result.problem.errors : undefined;
  return {
    issues: issuesOf(errors),
    errors: errors ?? [],
    atTag: tag,
    warnings: [],
    message: failureText(result),
    toast: null,
  };
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

export interface UploadStart {
  slots: SlotStates;
  // False when the file is refused here, before anything is sent.
  send: boolean;
}

export function uploadStart(
  slots: SlotStates,
  slot: ImageSlot,
  file: { type: string; size: number },
): UploadStart {
  const refused = uploadRefusal(slot, file);
  return refused === null
    ? { slots: slotBusy(slots, slot), send: true }
    : { slots: slotFailed(slots, slot, refused), send: false };
}

// The slot once its upload has answered.
export function slotAfterUpload(
  slots: SlotStates,
  slot: ImageSlot,
  result: GatewayResult<ThemeAsset>,
): SlotStates {
  return result.ok ? slotDone(slots, slot) : slotFailed(slots, slot, uploadFailureOf(slot, result));
}

// What an answered upload puts in its slot, nothing when it was refused.
export function uploadedImage(
  slot: ImageSlot,
  result: GatewayResult<ThemeAsset>,
  values: ImageValues,
): Logo | Plain | null {
  return result.ok ? imageAfterUpload(slot, result.data.id, values) : null;
}

// Runs `select` for a tab this area has, and for no other name.
export function selectOffered(name: string, select: (tab: OfferedTab) => void): void {
  const tab = tabNamed(OFFERED_TABS, name);
  if (tab !== undefined) select(tab);
}
