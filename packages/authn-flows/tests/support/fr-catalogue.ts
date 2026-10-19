import { type PageLocale } from '@odudu/kernel';
import type * as Messages from '#/view/messages';

// A French catalogue that exists only in tests: SHIPPED_LOCALES stays `en`.
// A renderer test mocks `#/view/messages` with `withFrench` so the real
// renderer reads French through the same functions it reads English through.
export const FRENCH: PageLocale = { tag: 'fr', dir: 'ltr' };
export const ARABIC: PageLocale = { tag: 'ar', dir: 'rtl' };

export function withFrench(
  real: typeof Messages,
  fr: Partial<typeof Messages.en>,
): typeof Messages {
  return { ...real, ...real.translators({ en: real.en, fr }) };
}
