// A tenant name is operator-supplied and lands in an HTML body a mail client
// renders, so it is escaped; the link, which this package is handed already
// built, is never passed through here.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
