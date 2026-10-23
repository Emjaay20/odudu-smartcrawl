import { negotiatePageLocale } from '@odudu/i18n';
import { type PageLocale, withPageTheme } from '@odudu/kernel';
import { type FastifyRequest } from 'fastify';

// The language an account page is shown in. Nothing is parked here and the
// person is not signed in, so the browser's preference alone chooses; the
// light or dark choice comes from the odudu-theme cookie.
export function requestLocale(
  request: FastifyRequest,
  deps: { pageLocales?: readonly string[] | undefined } = {},
): PageLocale {
  return withPageTheme(
    negotiatePageLocale({
      acceptLanguage: request.headers['accept-language'],
      ...(deps.pageLocales === undefined ? {} : { supported: deps.pageLocales }),
    }),
    request.headers.cookie,
  );
}
