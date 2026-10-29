import { CLIENT_NAME_MAX, DESCRIPTION_MAX } from '@odudu/contracts/admin';
import type { Translations } from '#/shared/service/localised';

export const TRANSLATIONS_LEAD =
  'How the client is named in another language, on the consent screen and wherever else a person meets it. A language left empty shows the name and description above.';

export const NAME_TRANSLATIONS_LABEL = 'Name';
export const NAME_TRANSLATIONS_NOTE = `At most ${String(CLIENT_NAME_MAX)} characters in each language.`;
export const DESCRIPTION_TRANSLATIONS_LABEL = 'Description';
export const DESCRIPTION_TRANSLATIONS_NOTE = `At most ${String(DESCRIPTION_MAX)} characters in each language.`;

export const NAME_LIMIT = CLIENT_NAME_MAX;
export const DESCRIPTION_LIMIT = DESCRIPTION_MAX;

export interface TranslationValues {
  name_i18n?: Translations;
  description_i18n?: Translations;
}

// A map is replaced whole by a PATCH, so one is sent only when it was edited.
export function translationsPatch(changes: TranslationValues): TranslationValues {
  return {
    ...(changes.name_i18n === undefined ? {} : { name_i18n: changes.name_i18n }),
    ...(changes.description_i18n === undefined
      ? {}
      : { description_i18n: changes.description_i18n }),
  };
}

// A map as a conflict panel names it: the languages it holds text for.
export function describeTranslations(value: unknown): string {
  if (typeof value !== 'object' || value === null) return 'none';
  const tags = Object.keys(value);
  return tags.length === 0 ? 'none' : tags.join(', ');
}
