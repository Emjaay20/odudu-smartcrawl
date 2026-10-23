import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { escapeHtml, page } from '#/view/document';
import { lostArt } from '#/view/lost-art';
import { t, tHtml } from '#/view/messages';

// Where this deployment can send somebody who followed a wrong address. Each
// is a fixed address chosen at boot, never anything the request carried, so
// the page reflects nothing and cannot be made to point elsewhere.
export interface NotFoundLinks {
  readonly console?: string;
  readonly docs?: string;
}

// The same page for an unknown path and for a path under a tenant that does
// not exist: it names neither, so it says nothing about which tenants exist.
export function renderNotFoundPage(links: NotFoundLinks, locale: PageLocale): RenderedPage {
  const items = [
    links.console === undefined
      ? ''
      : `<li><a href="${escapeHtml(links.console)}">${tHtml(locale, 'notFound.link.console')}</a></li>\n`,
    links.docs === undefined
      ? ''
      : `<li><a href="${escapeHtml(links.docs)}">${tHtml(locale, 'notFound.link.docs')}</a></li>\n`,
  ].join('');
  return page(
    t(locale, 'notFound.title'),
    `${lostArt(false)}
<h1>${tHtml(locale, 'notFound.title')}</h1>
<p>${tHtml(locale, 'notFound.body')}</p>${items === '' ? '' : `\n<ul>\n${items}</ul>`}`,
    null,
    [],
    locale,
  );
}
