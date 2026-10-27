import { type PageKind } from '#/page-kinds';
import { type PageLocale } from '#/page';
import { fillTemplate } from '#/slots';

// A theme's template for `kind` when the locale carries one that still fills,
// else the package's default. A template saved against an older manifest or
// catalogue gives way to the default rather than a failed page, and the
// locale's `templateFallback` is told why. `text` throws for a key its
// catalogue lacks.
export function fillPageTemplate(
  kind: PageKind,
  defaultTemplate: string,
  parts: Readonly<Record<string, string>>,
  locale: PageLocale,
  text: (key: string) => string,
): string {
  const own = locale.branding?.templates[kind];
  if (own !== undefined) {
    try {
      return fillTemplate(own, parts, text);
    } catch (error) {
      locale.templateFallback?.(kind, error instanceof Error ? error.message : 'unfillable');
    }
  }
  return fillTemplate(defaultTemplate, parts, text);
}
