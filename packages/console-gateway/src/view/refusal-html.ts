import { DEFAULT_PAGE_LOCALE, type PageLocale, type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';

const TITLE = 'Sign-in failed';
const BODY = `<h1>Sign-in failed</h1>
<p>The sign-in could not be completed.</p>
<p><a href="/console/">Sign in again</a></p>`;

// Deliberately the same page for every refusal, so a response says nothing
// about which check a forged or stale callback failed.
export function renderSignInRefused(locale: PageLocale = DEFAULT_PAGE_LOCALE): RenderedPage {
  return page(TITLE, BODY, null, [], locale);
}
