import { escapeHtml } from '#/view/document';

// Carries the sign-in path a person arrived with through a form that
// re-renders, so the way back survives a refusal. `signInPath` has already
// been checked by #/service/sign-in-path.
export function returnToField(signInPath: string | null | undefined): string {
  return signInPath === null || signInPath === undefined
    ? ''
    : `\n  <input type="hidden" name="return_to" value="${escapeHtml(signInPath)}">`;
}
