import type { FieldError, PublishThemeResponse, ThemeView } from '@odudu/contracts/admin';
import { counted } from '#/shared/service/format';
import type { Problem } from '#/shared/service/result';

export const PUBLISH_TITLE = 'Publish';

export const PUBLISH_BODY =
  'Publishing makes the saved draft what people see on the sign-in and account pages, and keeps the version it replaces. Nothing is published until you do.';

export const NO_DRAFT_HOLD = 'There is no draft to publish. Save a change first.';

export const UNSAVED_HOLD = 'Save your changes first: publishing uses the saved draft.';

export function publishHold({
  view,
  unsaved,
  contrast,
}: {
  view: ThemeView;
  unsaved: boolean;
  contrast: string | undefined;
}): string | undefined {
  if (unsaved) return UNSAVED_HOLD;
  if (view.draft === null) return NO_DRAFT_HOLD;
  return contrast;
}

export function publishedText(view: ThemeView): string {
  if (view.published === null) return 'Nothing published yet: people see Instrument’s own pages.';
  return `Version ${String(view.published.version)} is published.`;
}

export function draftText(view: ThemeView): string {
  return view.draft === null ? 'No draft.' : 'A saved draft is waiting to be published.';
}

export const PUBLISHED_TOAST = 'Theme published';

// The most refusals listed at once; the server stops at 100.
export const ISSUES_SHOWN = 20;

export function issueLine(error: FieldError): string {
  const place =
    error.line === undefined || error.line === null
      ? ''
      : ` (line ${String(error.line)}${error.column === undefined || error.column === null ? '' : `, column ${String(error.column)}`})`;
  return `${error.path}: ${error.message}${place}`;
}

export interface Issues {
  lines: readonly string[];
  // Said after the lines when the server named more than are shown.
  more: string | null;
}

export function issuesOf(errors: readonly FieldError[] | undefined): Issues {
  const all = errors ?? [];
  const lines = all.slice(0, ISSUES_SHOWN).map(issueLine);
  const rest = all.length - lines.length;
  return {
    lines,
    more: rest > 0 ? `and ${counted(rest, 'more problem', 'more problems')}` : null,
  };
}

export const NO_ISSUES: Issues = { lines: [], more: null };

export function warningLines(response: PublishThemeResponse): readonly string[] {
  return response.warnings.map((warning) => `${warning.piece}: ${warning.message}`);
}

export const WARNINGS_TITLE = 'Published, with a warning';

export const WARNINGS_NOTE =
  'A stylesheet or a template cannot be proven accessible. Published anyway; check the pages yourself.';

// What the server's refusal of a publish or restore comes to in words.
export function refusalText(problem: Problem, verb: string): string | null {
  if (problem.type.endsWith('#theme-no-draft')) return NO_DRAFT_HOLD;
  if (problem.type.endsWith('#theme-assets-missing')) {
    return `This version cannot be ${verb}: an image it names has been deleted.`;
  }
  if (problem.type.endsWith('#theme-version-fails-checks')) {
    return `This version cannot be ${verb}: some of its pieces fail today’s checks.`;
  }
  if (problem.status === 400) return `The theme was not ${verb}. Fix what is listed.`;
  return null;
}

export function publishConflict(): string {
  return 'Somebody saved the draft after you opened it. Reload the page to see their version, then publish.';
}

// A refusal that joins many problems, cut to as many as one field shows.
export function limitedIssues(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const parts = text.split('; ');
  if (parts.length <= ISSUES_SHOWN) return text;
  const rest = parts.length - ISSUES_SHOWN;
  return `${parts.slice(0, ISSUES_SHOWN).join('; ')}; and ${counted(rest, 'more problem', 'more problems')}`;
}
