import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';
import { lostArt } from '#/view/lost-art';
import { t, tHtml } from '#/view/messages';

// A fixed page for any unhandled failure. It shows the request id, which is
// what an operator searches the log for, and nothing the failure carried: an
// error message can hold a query and its parameters.
export function renderServerErrorPage(requestId: string | null, locale: PageLocale): RenderedPage {
  const reference =
    requestId === null
      ? ''
      : `\n<p><small>${tHtml(locale, 'serverError.requestId', {}, { id: requestId })}</small></p>`;
  return page(
    t(locale, 'serverError.title'),
    `${lostArt(true)}
<h1>${tHtml(locale, 'serverError.title')}</h1>
<p>${tHtml(locale, 'serverError.body')}</p>${reference}`,
    null,
    [],
    locale,
  );
}
