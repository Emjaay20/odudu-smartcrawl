import { type PageLocale } from '@odudu/i18n';
import { escapeHtml } from '#/service/escape';
import { MARK_CID } from '#/service/mark';
import { bdi, t } from '#/service/messages';
import { MAIL_PALETTE } from '#/service/palette.generated';
import { type MailPalette } from '#/service/palette';

export type Block =
  | { readonly kind: 'paragraph'; readonly html: string }
  | { readonly kind: 'list'; readonly items: readonly string[] };

export interface ShellInput {
  readonly locale: PageLocale;
  /** The tenant's display name as typed: it is escaped and isolated here. */
  readonly tenant: string;
  /** The send time; the footer's year is its UTC year. */
  readonly now: Date;
  /** Plain text, for the document title and the heading. */
  readonly heading: string;
  /** Markup the caller built from the catalogue, already escaped. */
  readonly blocks: readonly Block[];
  readonly action?: { readonly label: string; readonly href: string } | undefined;
  /** Muted closing lines, as escaped markup. */
  readonly closing?: readonly string[];
  /** Why the recipient got this, as escaped markup. */
  readonly reason: string;
}

const SANS = 'system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
const WIDTH = 560;
// A name or an address with no break opportunity wraps instead of widening the page.
const WRAP = 'word-break:break-word;overflow-wrap:anywhere';
const SCHEMES = ['light', 'dark'].join(' ');

// Codes, not sentences: they reach a developer's log, never a recipient.
const LINK_REFUSED = 'mail-link-not-absolute-web-address';
const TIME_REFUSED = 'mail-send-time-invalid';

// A link this package is handed is built by the server from its public base
// URL; the shell still refuses anything that is not a web address, because
// the href is the one place a mail's markup takes a URL.
export function safeHref(link: string): string {
  let protocol: string;
  try {
    protocol = new URL(link).protocol;
  } catch {
    throw new RangeError(LINK_REFUSED);
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new RangeError(LINK_REFUSED);
  }
  return link;
}

export function sendYear(now: Date): number {
  if (Number.isNaN(now.getTime())) throw new RangeError(TIME_REFUSED);
  return now.getUTCFullYear();
}

function rule(selector: string, declarations: Partial<Record<string, string>>): string {
  const body = Object.entries(declarations)
    .map(([property, value]) => `${property}:${value ?? ''}!important`)
    .join(';');
  return `${selector}{${body}}`;
}

// Clients that read prefers-color-scheme swap every colour here; the rest keep
// the inline light values, which carry the whole design on their own.
function darkStyles(dark: MailPalette['dark']): string {
  return [
    rule('.m-page', { 'background-color': dark.page }),
    rule('.m-panel', { 'background-color': dark.panel, 'border-color': dark.border }),
    rule('.m-sunken', { 'background-color': dark.sunken, 'border-color': dark.border }),
    rule('.m-ink', { color: dark.ink }),
    rule('.m-muted', { color: dark.muted }),
    rule('.m-link', { color: dark.link }),
    rule('.m-button', { 'background-color': dark.button }),
    rule('.m-button-link', { color: dark.buttonInk }),
  ].join('');
}

function headStyles(palette: MailPalette): string {
  return `:root{color-scheme:${SCHEMES};supported-color-schemes:${SCHEMES}}@media (prefers-color-scheme:dark){${darkStyles(palette.dark)}}`;
}

function paragraph(c: MailPalette['light'], start: string, html: string): string {
  return `<p class="m-ink" style="margin:0 0 16px;font:15px/1.5 ${SANS};color:${c.ink};text-align:${start};${WRAP}">${html}</p>`;
}

function list(c: MailPalette['light'], start: string, items: readonly string[]): string {
  const rows = items
    .map(
      (item) =>
        `<li class="m-ink" style="margin:0 0 6px;font:15px/1.5 ${SANS};color:${c.ink};${WRAP}">${item}</li>`,
    )
    .join('');
  return `<ul style="margin:0 0 16px;padding:0 20px;text-align:${start}">${rows}</ul>`;
}

function muted(c: MailPalette['light'], start: string, html: string, size = 13): string {
  return `<p class="m-muted" style="margin:0 0 12px;font:${String(size)}px/1.5 ${SANS};color:${c.muted};text-align:${start};${WRAP}">${html}</p>`;
}

function button(c: MailPalette['light'], label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td class="m-button" bgcolor="${c.button}" align="center" style="background-color:${c.button};border-radius:4px;padding:12px 24px;mso-padding-alt:12px 24px"><a class="m-button-link" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;font:600 15px/20px ${SANS};color:${c.buttonInk};text-decoration:none;mso-line-height-rule:exactly">${escapeHtml(label)}</a></td></tr></table>`;
}

// The address, written out where it can be selected and copied, under the
// button that carries it.
function rawLink(c: MailPalette['light'], start: string, locale: PageLocale, href: string): string {
  const shown = escapeHtml(href);
  return `${muted(c, start, escapeHtml(t(locale, 'mail.linkFallback')))}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td class="m-sunken" bgcolor="${c.sunken}" style="background-color:${c.sunken};border:1px solid ${c.border};border-radius:4px;padding:10px 12px;font:13px/1.5 ${MONO};color:${c.link};word-break:break-all;overflow-wrap:anywhere;text-align:left" dir="ltr"><a class="m-link" href="${shown}" target="_blank" style="color:${c.link};text-decoration:underline;word-break:break-all">${shown}</a></td></tr></table>`;
}

function header(c: MailPalette['light'], input: ShellInput, start: string): string {
  const alt = escapeHtml(t(input.locale, 'mail.brand'));
  const gap = start === 'left' ? 'right' : 'left';
  return `<tr><td style="padding:0 0 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-${gap}:12px"><img class="m-ink" src="cid:${MARK_CID}" width="40" height="40" alt="${alt}" style="display:block;width:40px;height:40px;border:0;border-radius:8px;font:600 14px/40px ${SANS};color:${c.ink}"></td><td valign="middle" class="m-ink" style="font:600 18px/1.3 ${SANS};color:${c.ink};text-align:${start};${WRAP}">${bdi(input.tenant)}</td></tr></table></td></tr>`;
}

function footer(c: MailPalette['light'], input: ShellInput, start: string): string {
  const year = String(sendYear(input.now));
  const copyright = escapeHtml(t(input.locale, 'mail.copyright', { year }));
  const powered = escapeHtml(t(input.locale, 'mail.poweredBy'));
  return `<tr><td style="padding:20px 0 0">${muted(c, start, input.reason, 12)}${muted(c, start, `${copyright} &middot; ${powered}`, 12)}</td></tr>`;
}

function blockHtml(c: MailPalette['light'], start: string, block: Block): string {
  return block.kind === 'paragraph' ? paragraph(c, start, block.html) : list(c, start, block.items);
}

export function renderShell(input: ShellInput): string {
  const c = MAIL_PALETTE.light;
  const dir = input.locale.dir;
  const start = dir === 'rtl' ? 'right' : 'left';
  const title = escapeHtml(input.heading);
  const action =
    input.action === undefined
      ? ''
      : button(c, input.action.label, input.action.href) +
        rawLink(c, start, input.locale, input.action.href);
  const closing = (input.closing ?? []).map((line) => muted(c, start, line)).join('');
  const panel = `<tr><td class="m-panel" bgcolor="${c.panel}" style="background-color:${c.panel};border:1px solid ${c.border};border-radius:4px;padding:32px 28px"><h1 class="m-ink" style="margin:0 0 16px;font:600 20px/1.3 ${SANS};color:${c.ink};text-align:${start};${WRAP}">${title}</h1>${input.blocks.map((block) => blockHtml(c, start, block)).join('')}${action}${closing}</td></tr>`;
  return `<!doctype html><html lang="${escapeHtml(input.locale.tag)}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${SCHEMES}"><meta name="supported-color-schemes" content="${SCHEMES}"><title>${title}</title><style>${headStyles(MAIL_PALETTE)}</style></head><body class="m-page" style="margin:0;padding:0;background-color:${c.page}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="m-page" bgcolor="${c.page}" style="background-color:${c.page}"><tr><td align="center" style="padding:24px 16px"><!--[if mso]><table role="presentation" width="${String(WIDTH)}" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${String(WIDTH)}px;table-layout:fixed">${header(c, input, start)}${panel}${footer(c, input, start)}</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
