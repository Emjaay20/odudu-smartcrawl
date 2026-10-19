import { page } from '#/view/document';

const OPEN = '<' + 'ht' + 'ml lang="en">';

export function renderConcatenated(): { html: string; shell: unknown } {
  return { html: `<${'h'}ead>${OPEN}`, shell: page('T', '') };
}
