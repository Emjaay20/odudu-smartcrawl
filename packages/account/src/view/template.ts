import { createPageFiller, type PageLocale } from '@odudu/kernel';
import { en, t, type MessageId } from '#/view/messages';
import { DEFAULT_TEMPLATES } from '#/view/templates/index';

export const fillPage = createPageFiller({
  defaults: DEFAULT_TEMPLATES,
  hasMessage: (key) => Object.hasOwn(en, key),
  // Checked by `hasMessage` first, so the key is one of the catalogue's.
  text: (locale, key) => t(locale, key as MessageId),
});

// What every outcome page without a form is filled with. `message` holds the
// heading, the text and any way on that the person needs; `links` only the
// ways back.
export function fillNotice(message: string, links: string, locale: PageLocale): string {
  return fillPage('notice', { intro: '', message, links }, locale);
}
