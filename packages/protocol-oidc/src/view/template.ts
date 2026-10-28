import { createPageFiller } from '@odudu/kernel';
import { en, t, type MessageId } from '#/view/messages';
import { DEFAULT_TEMPLATES } from '#/view/templates/index';

export const fillPage = createPageFiller({
  defaults: DEFAULT_TEMPLATES,
  hasMessage: (key) => Object.hasOwn(en, key),
  // Checked by `hasMessage` first, so the key is one of the catalogue's.
  text: (locale, key) => t(locale, key as MessageId),
});
