import { type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';

export function renderBad(name: string): RenderedPage {
  return page(
    'Sign in',
    `<h1>Welcome back</h1>
<p>Hello ${name}</p>`,
  );
}
