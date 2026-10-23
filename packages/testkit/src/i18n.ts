// A French catalogue that exists only in tests: SHIPPED_LOCALES stays `en`.
// A renderer test mocks its package's `#/view/messages` with `withFrench`, so
// the real renderer reads French through the same functions it reads English
// through.
interface TestLocale {
  readonly tag: string;
  readonly dir: 'ltr' | 'rtl';
}

export const FRENCH: TestLocale = { tag: 'fr', dir: 'ltr' };
export const ARABIC: TestLocale = { tag: 'ar', dir: 'rtl' };

interface CatalogueModule {
  readonly en: Readonly<Record<string, string>>;
  translators(byLocale: {
    en: Readonly<Record<string, string>>;
    fr: Readonly<Record<string, string>>;
  }): object;
}

// `real` is a package's messages module; `fr` the sentences a test asserts,
// every other id falling back to English per key.
export function withFrench<M extends CatalogueModule>(real: M, fr: Partial<Readonly<M['en']>>): M {
  const defined = Object.fromEntries(
    Object.entries(fr).flatMap(([id, text]) => (text === undefined ? [] : [[id, text]])),
  );
  return { ...real, ...real.translators({ en: real.en, fr: defined }) };
}
