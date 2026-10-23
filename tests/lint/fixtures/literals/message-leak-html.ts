import { PASSWORD_TOO_LONG } from '@odudu/kernel';
import { renderUpdatePasswordPage } from '#/view/update-password-html';
import { sendRequestError } from '#/view/routes/request-error';

export function leak(reply: unknown, locale: unknown, violations: readonly { message: string }[]) {
  renderUpdatePasswordPage('t', 's', [{ rule: 'x', message: PASSWORD_TOO_LONG.message }], locale);
  sendRequestError(reply, {}, 400, violations[0]?.message ?? '');
}
