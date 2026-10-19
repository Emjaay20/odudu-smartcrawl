import { t, tHtml } from '#/view/messages';

export function renderHelper(note: (text: string) => string, locale: unknown): string {
  return `<p>${note('Hello there')}</p><p>${t(locale, 'good.id')}</p><p>${tHtml(locale, 'good.other', {}, { name: 'Ada Lovelace' })}</p>`;
}
