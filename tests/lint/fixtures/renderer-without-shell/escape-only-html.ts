import { escapeHtml } from '#/view/document';

export function renderEscapeOnly(name: string): { html: string } {
  return { html: `<p>${escapeHtml(name)}</p>` };
}
