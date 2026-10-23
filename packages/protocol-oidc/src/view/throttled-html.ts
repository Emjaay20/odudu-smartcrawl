import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';
import { t, tHtml } from '#/view/messages';

// Identical whichever budget refused the request and decided before any
// account lookup, so it names no cause and offers no link: building one
// would need a read of the parked request, which a flood must not cost.
export function renderThrottledPage(retryAfterSeconds: number, locale: PageLocale): RenderedPage {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  return page(
    t(locale, 'throttled.title'),
    `<h1>${tHtml(locale, 'throttled.title')}</h1>
<p>${tHtml(locale, 'throttled.retryAfter', { seconds })}</p>
<p>${tHtml(locale, 'throttled.goBack')}</p>`,
    null,
    [],
    locale,
  );
}
