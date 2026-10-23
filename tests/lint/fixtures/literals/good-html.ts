import { type PageLocale, type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';
import { t, tHtml } from '#/view/messages';

export function renderGood(name: string, locale: PageLocale): RenderedPage {
  return page(
    t(locale, 'good.title'),
    `<h1>${tHtml(locale, 'good.heading')}</h1>
<p>${tHtml(locale, 'good.greeting', {}, { name })} &middot; <small>${name}</small></p>
<form method="post" action="/x" id="the-form">
  <input type="hidden" name="token" value="${name}">
  <input type="text" name="label" placeholder="${tHtml(locale, 'good.placeholder')}">
  <button type="submit" value="${t(locale, 'good.submit')}">${tHtml(locale, 'good.submit')}</button>
</form>
<script nonce="n">
const form = document.getElementById('the-form');
form.addEventListener('submit', () => { form.dataset.state = 'sent'; });
</script>`,
    null,
    [],
    locale,
  );
}
