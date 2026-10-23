import { PASSWORD_TOO_LONG } from '@odudu/kernel';
import { renderUpdatePasswordPage } from '#/view/update-password-html';

export function clean(locale: unknown) {
  renderUpdatePasswordPage('t', 's', [PASSWORD_TOO_LONG], locale);
  const text = new Error('x').message;
  return text;
}
