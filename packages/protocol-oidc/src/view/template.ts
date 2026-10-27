import { fillTemplate, type PageLocale } from '@odudu/kernel';
import { en, t, type MessageId } from '#/view/messages';
import { DEFAULT_TEMPLATES, type TemplatedKind } from '#/view/templates/index';

function isMessageId(key: string): key is MessageId {
  return Object.hasOwn(en, key);
}

// `parts` holds every name the page kind's manifest lists, an empty string
// for one this render has nothing for, so a template may place any of them.
// A theme's template that no longer fills (it was saved against an older
// manifest or catalogue) gives way to the default rather than a failed page,
// and the locale's `templateFallback` is told why.
export function fillPage(
  kind: TemplatedKind,
  parts: Readonly<Record<string, string>>,
  locale: PageLocale,
): string {
  const text = (key: string): string => {
    if (!isMessageId(key)) throw new Error(`unknown message ${key}`);
    return t(locale, key);
  };
  const own = locale.branding?.templates[kind];
  if (own !== undefined) {
    try {
      return fillTemplate(own, parts, text);
    } catch (error) {
      locale.templateFallback?.(kind, error instanceof Error ? error.message : 'unfillable');
    }
  }
  return fillTemplate(DEFAULT_TEMPLATES[kind], parts, text);
}
