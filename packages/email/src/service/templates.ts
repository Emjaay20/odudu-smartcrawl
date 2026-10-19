import { randomUUID } from 'node:crypto';
import { stripBidiControls } from '@odudu/contracts';
import { negotiateLocale, type PageLocale } from '@odudu/i18n';
import { bdi, catalogue, en, t, tHtml, type MessageId } from '#/service/messages';
import { type EmailMessage } from '#/service/sender';

interface MailInput {
  readonly to: string;
  readonly link: string;
  readonly tenantDisplayName: string;
  // The recipient's own `locale` where the sender knows it, else the tenant's
  // default, else none: the mail is then English. A tag this build holds no
  // catalogue for is reduced to the nearest one it does, as a page's is.
  readonly locale?: string | null | undefined;
}

export type VerifyEmailInput = MailInput;
export type ResetPasswordInput = MailInput;

export interface RequiredActionsInput extends MailInput {
  /** The codes of what each action asks of the subject, in the order it will be asked. */
  readonly actions: readonly string[];
}

const FSI = '\u2068';
const PDI = '\u2069';

// C0 and C1 controls, which include CR, LF and NEL, and the Unicode line and
// paragraph separators.
const LINE_CONTROLS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/gu;

// The link is HTML the template builds around a value it is handed already
// formed; a message names it `{link}` and the one anchor replaces this token,
// which no tenant name can spell because it is drawn at start-up.
const LINK_SLOT = `link-${randomUUID()}`;

function mailLocale(requested: string | null | undefined): PageLocale {
  return negotiateLocale({
    uiLocales: [],
    subjectLocale: requested ?? null,
    authenticated: true,
    tenantDefault: null,
    acceptLanguage: null,
    supported: catalogue.locales,
  });
}

// A header cannot carry an isolate, so the subject loses the controls that
// would reorder it and every character that could end the header line.
function inSubject(name: string): string {
  return stripBidiControls(name).replace(LINE_CONTROLS, ' ').trim();
}

// An isolate holds the name's own direction inside the sentence around it. The
// name loses the controls that could close that isolate early and every line
// break, so it cannot start a line of its own.
function inText(name: string): string {
  return `${FSI}${stripBidiControls(name).replace(LINE_CONTROLS, ' ')}${PDI}`;
}

function anchor(link: string): string {
  return `<a href="${link}">${link}</a>`;
}

function withLink(html: string, link: string): string {
  return html.split(LINK_SLOT).join(anchor(link));
}

function actionId(code: string): MessageId | null {
  const id = `action.${code}`;
  return Object.hasOwn(en, id) ? (id as MessageId) : null;
}

function actionText(locale: PageLocale, code: string): string {
  const id = actionId(code);
  return id === null ? inText(code) : t(locale, id);
}

function actionHtml(locale: PageLocale, code: string): string {
  const id = actionId(code);
  return id === null ? bdi(stripBidiControls(code)) : tHtml(locale, id);
}

export function renderVerifyEmail(input: VerifyEmailInput): EmailMessage {
  const locale = mailLocale(input.locale);
  const tenant = input.tenantDisplayName;
  return {
    to: input.to,
    subject: t(locale, 'verify.subject', { tenant: inSubject(tenant) }),
    text: `${t(locale, 'verify.text', { tenant: inText(tenant) })}\n\n${input.link}\n\n${t(locale, 'mail.notRequested')}`,
    html: `<p>${withLink(
      tHtml(locale, 'verify.html', { link: LINK_SLOT }, { tenant: stripBidiControls(tenant) }),
      input.link,
    )}</p><p>${tHtml(locale, 'mail.notRequested')}</p>`,
  };
}

export function renderResetPassword(input: ResetPasswordInput): EmailMessage {
  const locale = mailLocale(input.locale);
  const tenant = input.tenantDisplayName;
  return {
    to: input.to,
    subject: t(locale, 'reset.subject', { tenant: inSubject(tenant) }),
    text: `${t(locale, 'reset.text', { tenant: inText(tenant) })}\n\n${input.link}\n\n${t(locale, 'mail.notRequested')}`,
    html: `<p>${withLink(
      tHtml(locale, 'reset.html', { link: LINK_SLOT }, { tenant: stripBidiControls(tenant) }),
      input.link,
    )}</p><p>${tHtml(locale, 'mail.notRequested')}</p>`,
  };
}

export function renderRequiredActions(input: RequiredActionsInput): EmailMessage {
  const locale = mailLocale(input.locale);
  const tenant = input.tenantDisplayName;
  const listed = input.actions.map((code) => `- ${actionText(locale, code)}`).join('\n');
  const items = input.actions.map((code) => `<li>${actionHtml(locale, code)}</li>`).join('');
  return {
    to: input.to,
    subject: t(locale, 'actions.subject', { tenant: inSubject(tenant) }),
    text: `${t(locale, 'actions.text', { tenant: inText(tenant) })}\n\n${listed}\n\n${t(locale, 'actions.textLink')}\n\n${input.link}\n\n${t(locale, 'actions.ignore')}`,
    html: `<p>${tHtml(locale, 'actions.text', {}, { tenant: stripBidiControls(tenant) })}</p><ul>${items}</ul><p>${withLink(
      tHtml(locale, 'actions.html', { link: LINK_SLOT }),
      input.link,
    )}</p><p>${tHtml(locale, 'actions.ignore')}</p>`,
  };
}

export interface SmtpTestInput {
  readonly to: string;
  readonly locale?: string | null | undefined;
}

export function renderSmtpTest(input: SmtpTestInput): EmailMessage {
  const locale = mailLocale(input.locale);
  return {
    to: input.to,
    subject: t(locale, 'smtpTest.subject'),
    text: t(locale, 'smtpTest.text'),
    html: `<p>${tHtml(locale, 'smtpTest.text')}</p>`,
  };
}
