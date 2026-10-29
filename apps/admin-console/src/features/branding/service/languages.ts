import { MAIL_PREVIEW_LOCALES, type AmendSettingsRequest } from '@odudu/contracts/admin';
import { localeName } from '#/shared/service/locales';
import type { Choice } from '#/shared/service/choice';
import type { SectionFields } from '#/shared/service/sectionSave';

// The languages this build holds a catalogue for; a test in packages/email
// holds the list equal to the i18n package's SHIPPED_LOCALES.
export const SHIPPED_LANGUAGES: readonly string[] = MAIL_PREVIEW_LOCALES;

export const LANGUAGES_SECTION = 'languages';

export const LANGUAGES_TITLE = 'Languages';

export const LANGUAGES_DESCRIPTION =
  'The languages the tenant’s pages and mail are offered in, and the one used when a visitor’s browser does not decide.';

export const SUPPORTED_LABEL = 'Supported languages';

export const SUPPORTED_NOTE =
  'A language the build ships with is complete. Any other the tenant already offers stays listed; its pages use the English text unless a message override says otherwise.';

export const DEFAULT_LABEL = 'Default language';

export const DEFAULT_NOTE =
  'Used ahead of the browser’s preference, when the request names no language.';

export const BROWSER_DECIDES = 'The browser decides';

export interface LanguageValues extends Readonly<Record<string, unknown>> {
  supported_locales: readonly string[];
  default_locale: string;
}

export interface LanguageSettings {
  supported_locales: readonly string[];
  default_locale: string | null;
}

function isTag(value: unknown): value is string {
  return typeof value === 'string';
}

// The two settings out of the whole record, which the contract types loosely.
export function languageSettingsOf(settings: Readonly<Record<string, unknown>>): LanguageSettings {
  const supported = settings.supported_locales;
  const fallback = settings.default_locale;
  return {
    supported_locales: Array.isArray(supported) ? supported.filter(isTag) : [],
    default_locale: isTag(fallback) && fallback !== '' ? fallback : null,
  };
}

export function languagesOf(settings: LanguageSettings): LanguageValues {
  return {
    supported_locales: settings.supported_locales,
    default_locale: settings.default_locale ?? '',
  };
}

// The shipped languages, then any other the tenant already offers, each once.
export function languageTags(supported: readonly string[]): string[] {
  return [...new Set([...SHIPPED_LANGUAGES, ...supported])];
}

export function languageLabel(tag: string): string {
  return `${localeName(tag, 'en')} (${tag})`;
}

export function supportedChoices(supported: readonly string[]): Choice[] {
  return languageTags(supported).map((tag) => ({ id: tag, label: languageLabel(tag) }));
}

// "The browser decides" is only a choice while it is what is saved: the
// settings take a language tag, so a default once set cannot be cleared here.
export function defaultChoices(supported: readonly string[], saved: string): Choice[] {
  const tags = supported.map((tag) => ({ id: tag, label: languageLabel(tag) }));
  return saved === '' ? [{ id: '', label: BROWSER_DECIDES }, ...tags] : tags;
}

export const NONE_SUPPORTED = 'Offer at least one language.';

export const DEFAULT_NOT_SUPPORTED = 'The default language must be one of the supported languages.';

// Why the section cannot be saved, or undefined when it can.
export function languagesHold(values: LanguageValues): string | undefined {
  if (values.supported_locales.length === 0) return NONE_SUPPORTED;
  return values.default_locale !== '' && !values.supported_locales.includes(values.default_locale)
    ? DEFAULT_NOT_SUPPORTED
    : undefined;
}

// Only what changed is sent, and a default is only ever set, never cleared.
export function languagesRequest(changes: Partial<LanguageValues>): AmendSettingsRequest {
  return {
    ...(changes.supported_locales === undefined
      ? {}
      : { supported_locales: [...changes.supported_locales] }),
    ...(changes.default_locale === undefined || changes.default_locale === ''
      ? {}
      : { default_locale: changes.default_locale }),
  };
}

// The tags a message override can be written for: the supported ones.
export function overrideLocales(supported: readonly string[]): Choice[] {
  return supported.map((tag) => ({ id: tag, label: languageLabel(tag) }));
}

// The language the overrides open on: the default if it is offered, else the first.
export function openingLocale(settings: LanguageSettings): string {
  const { default_locale: fallback, supported_locales: supported } = settings;
  return fallback !== null && supported.includes(fallback) ? fallback : (supported[0] ?? 'en');
}

export const DEFAULT_NONE = 'the browser decides';

// The section's fields as the save reads them: the label a conflict or a
// restored draft names, and how a value reads aloud.
export function languageFields(base: LanguageValues): SectionFields<LanguageValues> {
  return {
    supported_locales: {
      value: base.supported_locales,
      label: SUPPORTED_LABEL,
      kind: 'plain',
      describe: (value) => (Array.isArray(value) ? value.join(', ') : ''),
    },
    default_locale: {
      value: base.default_locale,
      label: DEFAULT_LABEL,
      kind: 'plain',
      describe: (value) => (value === '' ? DEFAULT_NONE : String(value)),
    },
  };
}
