import { negotiateLocale, type PageLocale } from '#/service/negotiate';
import { SHIPPED_LOCALES } from '#/service/shipped';

export interface PageLocaleInput {
  // The parked request's `ui_locales`, when the page continues one.
  readonly uiLocales?: readonly string[];
  // The signed-in subject's `locale`, read only when `authenticated`.
  readonly subjectLocale?: string | null;
  // Whether the first factor has been verified (ADR 0043: before that the
  // subject's locale would reveal whether an account exists).
  readonly authenticated?: boolean;
  // The tenant's default locale; none is stored yet.
  readonly tenantDefault?: string | null;
  // What the request carried, in whatever shape the transport hands over.
  readonly acceptLanguage?: unknown;
  readonly supported?: readonly string[];
}

// A header a transport may hand over once, repeated, or not at all; anything
// that is not text is no preference.
function headerText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string').join(',');
  }
  return null;
}

// The one answer to "which language is this page in", computed before a
// renderer runs so the text and the `lang`/`Content-Language` it is sent
// under come from the same value. Every input is optional: a page with no
// parked request negotiates on the browser's preference alone.
export function negotiatePageLocale(input: PageLocaleInput = {}): PageLocale {
  return negotiateLocale({
    uiLocales: input.uiLocales ?? [],
    subjectLocale: input.subjectLocale ?? null,
    authenticated: input.authenticated ?? false,
    tenantDefault: input.tenantDefault ?? null,
    acceptLanguage: headerText(input.acceptLanguage),
    supported: input.supported ?? SHIPPED_LOCALES,
  });
}
