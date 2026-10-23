import * as cheerio from 'cheerio';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The markup a component renders on the server, ready to query.
export function markupOf(element: ReactElement): cheerio.CheerioAPI {
  return cheerio.load(renderToStaticMarkup(element), null, false);
}
