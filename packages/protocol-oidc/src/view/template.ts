import { fillPageTemplate, type PageLocale } from '@odudu/kernel';
import { en, t, type MessageId } from '#/view/messages';
import { DEFAULT_TEMPLATES, type TemplatedKind } from '#/view/templates/index';

function isMessageId(key: string): key is MessageId {
  return Object.hasOwn(en, key);
}

// `parts` holds every name the page kind's manifest lists, an empty string
// for one this render has nothing for, so a template may place any of them.
export function fillPage(
  kind: TemplatedKind,
  parts: Readonly<Record<string, string>>,
  locale: PageLocale,
): string {
  return fillPageTemplate(kind, DEFAULT_TEMPLATES[kind], parts, locale, (key) => {
    if (!isMessageId(key)) throw new Error(`unknown message ${key}`);
    return t(locale, key);
  });
}
