import { negotiatePageLocale } from '@odudu/i18n';
import { type PageLocale } from '@odudu/kernel';
import { type FastifyRequest } from 'fastify';

// The language an account page is shown in. Nothing is parked here and the
// person is not signed in, so the browser's preference alone chooses.
export function requestLocale(
  request: FastifyRequest,
  deps: { pageLocales?: readonly string[] | undefined } = {},
): PageLocale {
  return negotiatePageLocale({
    acceptLanguage: request.headers['accept-language'],
    ...(deps.pageLocales === undefined ? {} : { supported: deps.pageLocales }),
  });
}
