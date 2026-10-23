import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';
import { t, tHtml } from '#/view/messages';

// Deliberately the same page for every refusal, so a response says nothing
// about which check a forged or stale callback failed.
export function renderSignInRefused(locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'refusal.title'),
    `<h1>${tHtml(locale, 'refusal.title')}</h1>
<p>${tHtml(locale, 'refusal.reason')}</p>
<p><a href="/console/">${tHtml(locale, 'refusal.again')}</a></p>`,
    null,
    [],
    locale,
  );
}
