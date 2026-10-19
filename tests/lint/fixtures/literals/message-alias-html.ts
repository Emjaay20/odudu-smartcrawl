import { renderUpdatePasswordPage } from '#/view/update-password-html';

export function aliased(violation: { message: string }, locale: unknown) {
  const text = violation.message;
  renderUpdatePasswordPage('t', 's', [{ rule: 'x', message: text }], locale);
}

export function bracketed(violation: { message: string }, locale: unknown) {
  renderUpdatePasswordPage('t', 's', [{ rule: 'x', message: violation['message'] }], locale);
}

export function destructured(violation: { message: string }, locale: unknown) {
  const { message } = violation;
  renderUpdatePasswordPage('t', 's', [{ rule: 'x', message }], locale);
}

export function unrelated(error: Error, log: (text: string) => void) {
  log(error.message);
}
