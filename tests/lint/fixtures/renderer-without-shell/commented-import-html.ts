// import { page } from '#/view/document';
// return page('Title', '<p>hello</p>');
const NOTE = "from '#/view/document' page(";

export function renderCommented(): { html: string; note: string } {
  return { html: '<p>hello</p>', note: NOTE };
}
