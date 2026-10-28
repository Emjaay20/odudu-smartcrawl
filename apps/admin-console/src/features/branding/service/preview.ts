import type { Scheme } from '#/features/branding/service/palette';
import { MANIFESTS } from '#/features/branding/service/templates';
import type { PageKind } from '#/features/branding/service/values';

export interface PreviewChoice {
  kind: PageKind;
  scheme: Scheme;
}

export const DEFAULT_PREVIEW: PreviewChoice = { kind: 'sign-in', scheme: 'light' };

export const PREVIEW_TITLE = 'Preview';

export const PREVIEW_KIND_LABEL = 'Page';

export const PREVIEW_SCHEME_LABEL = 'Colour scheme';

export const SCHEME_OPTIONS: readonly { id: Scheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export const PREVIEW_NOTE =
  'The saved draft, drawn by the real page. Unsaved changes appear after you save them.';

export const PREVIEW_FRAME_TITLE = 'Preview of the page';

export const PREVIEW_LOADING = 'Loading the preview';

export const PREVIEW_FAILED = 'The preview could not be drawn.';

export const SCRIPT_NOTE =
  'This page uses a script, which the preview leaves out. The real page runs it.';

// What the preview of a kind leaves out, when it leaves anything.
export function omissionNote(kind: PageKind): string | null {
  return MANIFESTS[kind].required.includes('script') ? SCRIPT_NOTE : null;
}
