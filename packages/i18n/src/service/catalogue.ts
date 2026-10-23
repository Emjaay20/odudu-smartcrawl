import { IntlMessageFormat } from 'intl-messageformat';

export type MessageValues = Readonly<Record<string, string | number | Date>>;

// `en` is complete; any other locale may omit keys.
export type Messages<T extends Record<string, string>> = Readonly<
  { en: T } & Record<string, Partial<T>>
>;

export interface Catalogue<T extends Record<string, string>> {
  readonly locales: readonly string[];
  format(locale: string, id: keyof T & string, values?: MessageValues): string;
}

const SOURCE = 'en';
// ADR 0043: no message carries markup, and ICU would parse this as a rich-text
// tag that `format()` strips or throws on, so it is refused where it is written.
const TAG = /<\/?[A-Za-z]/u;

function refuseRichText(
  byLocale: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>,
): void {
  for (const [locale, messages] of Object.entries(byLocale)) {
    for (const [id, message] of Object.entries(messages)) {
      if (message !== undefined && TAG.test(message)) {
        throw new Error(
          `message ${id} in ${locale} contains a tag: catalogue messages are plain text, never markup`,
        );
      }
    }
  }
}

// `en` is the source: a locale that lacks a key, or is not held at all, shows
// the English text, formatted under English rules so its plural arms apply.
export function createCatalogue<T extends Record<string, string>>(
  byLocale: Messages<T>,
): Catalogue<T> {
  refuseRichText(byLocale);
  const formatters = new Map<string, IntlMessageFormat>();

  function formatterFor(locale: string, id: string): IntlMessageFormat {
    const own = Object.hasOwn(byLocale, locale) ? byLocale[locale] : undefined;
    const ownMessage = own !== undefined && Object.hasOwn(own, id) ? own[id] : undefined;
    const resolved = ownMessage === undefined ? SOURCE : locale;
    const message = ownMessage ?? sourceMessage(id);
    const key = `${resolved}:${id}`;
    const cached = formatters.get(key);
    if (cached !== undefined) return cached;
    const built = new IntlMessageFormat(message, resolved);
    formatters.set(key, built);
    return built;
  }

  function sourceMessage(id: string): string {
    const source = Object.hasOwn(byLocale, SOURCE) ? byLocale[SOURCE] : undefined;
    const message = source !== undefined && Object.hasOwn(source, id) ? source[id] : undefined;
    if (message === undefined) throw new Error(`unknown message id: ${id}`);
    return message;
  }

  return {
    locales: Object.keys(byLocale),
    format(locale, id, values) {
      const out = formatterFor(locale, id).format(values);
      return typeof out === 'string' ? out : [out].flat().join('');
    },
  };
}
