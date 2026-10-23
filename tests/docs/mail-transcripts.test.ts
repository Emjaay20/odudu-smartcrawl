import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_PNG_BASE64 } from '../../packages/email/src/service/mark.generated.js';
import { en } from '../../packages/email/src/service/messages.js';
import {
  renderFinishRegistration,
  renderRecoveryCodesRevoked,
  renderRegistrationDuplicate,
  renderRequiredActions,
  renderResetPassword,
  renderSecondFactorRemoved,
  renderVerifyEmail,
} from '../../packages/email/src/service/templates.js';
import { ADMIN_PAGES, loadPages, PROTOCOL_PAGES } from './markdown.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const doc = (name: string): Promise<string> => readFile(path.join(ROOT, 'docs', name), 'utf8');
const pagesText = (directory: string): string => loadPages(directory).lines.join('\n');

const TO = 'recipient@example.test';
const FSI = '⁨';
const PDI = '⁩';

function linkOf(text: string): string {
  const found = /\n\n(http\S+)\n\n/u.exec(text)?.[1];
  if (found === undefined) throw new Error(`no link in ${text}`);
  return found;
}

// The footer's year is the send time's, so a transcript's year is read back
// out of it and the mail rendered at that year.
function sentAt(text: string): Date {
  const year = /© (\d{4}) Odudu/u.exec(text)?.[1];
  if (year === undefined) throw new Error(`no footer year in ${text}`);
  return new Date(Date.UTC(Number(year), 5, 1));
}

function tenantOf(text: string): string {
  const tenant = new RegExp(`${FSI}(.+?)${PDI}`, 'u').exec(text)?.[1];
  if (tenant === undefined) throw new Error(`no isolated tenant in ${text}`);
  return tenant;
}

// Each pino capture is one JSON object; the log carries the size of the
// markup, never the markup.
interface Capture {
  readonly subject: string;
  readonly text: string;
  readonly htmlBytes: number | null;
  readonly hasHtml: boolean;
  readonly line: number;
}

function captures(markdown: string): Capture[] {
  const found: Capture[] = [];
  const blocks = markdown.matchAll(/```json\n([\s\S]*?)\n```/gu);
  for (const block of blocks) {
    const body = block[1] ?? '';
    if (!body.includes('captured email')) continue;
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) continue;
    const { subject, text, htmlBytes, html } = parsed as Record<string, unknown>;
    if (typeof subject !== 'string' || typeof text !== 'string') continue;
    const line = markdown.slice(0, block.index).split('\n').length;
    found.push({
      subject,
      text,
      htmlBytes: typeof htmlBytes === 'number' ? htmlBytes : null,
      hasHtml: html !== undefined,
      line,
    });
  }
  return found;
}

function rendered(capture: Capture) {
  if (capture.subject.startsWith('You already have')) {
    return renderRegistrationDuplicate({
      to: TO,
      resetLink: linkOf(capture.text),
      tenantDisplayName: tenantOf(capture.text),
      now: sentAt(capture.text),
    });
  }
  if (capture.subject.startsWith('Finish creating')) {
    return renderFinishRegistration({
      to: TO,
      link: linkOf(capture.text),
      tenantDisplayName: tenantOf(capture.text),
      now: sentAt(capture.text),
    });
  }
  const input = {
    to: TO,
    link: linkOf(capture.text),
    tenantDisplayName: tenantOf(capture.text),
    now: sentAt(capture.text),
  };
  return capture.subject.startsWith('Reset')
    ? renderResetPassword(input)
    : renderVerifyEmail(input);
}

const anchors = (html: string): string[] => html.match(/<a [^>]*>[^<]*<\/a>/gu) ?? [];

describe('the mail the guides record is what the templates produce', () => {
  it('matches every captured verification and reset mail in the protocol pages', () => {
    const found = captures(pagesText(PROTOCOL_PAGES));
    expect(found.length).toBeGreaterThanOrEqual(4);
    expect(found.some((capture) => capture.subject.startsWith('You already have'))).toBe(true);
    for (const capture of found) {
      const real = rendered(capture);
      expect(capture.subject, `line ${String(capture.line)}`).toBe(real.subject);
      expect(capture.text, `line ${String(capture.line)}`).toBe(real.text);
      expect(capture.hasHtml, `line ${String(capture.line)}`).toBe(false);
      expect(capture.htmlBytes, `line ${String(capture.line)}`).toBe(Buffer.byteLength(real.html));
    }
  });

  it('shows the button and the written-out link the verification mail really has', () => {
    const markdown = pagesText(PROTOCOL_PAGES);
    const found = /grep -o '<a \[\^>\]\*>\[\^<\]\*<\/a>'\n```\n\n```\n([\s\S]*?)\n```/u.exec(
      markdown,
    );
    if (found?.[1] === undefined) throw new Error('no anchor excerpt in the protocol pages');
    const shown = found[1].split('\n');
    const href = /href="([^"]+)"/u.exec(shown[0] ?? '')?.[1];
    if (href === undefined) throw new Error('no href in the first anchor');
    const demo = captures(markdown).find((c) => c.subject === 'Verify your demo account');
    if (demo === undefined) throw new Error('no demo verification capture');
    const real = renderVerifyEmail({
      to: TO,
      link: href,
      tenantDisplayName: tenantOf(demo.text),
      now: sentAt(demo.text),
    });
    expect(shown).toEqual(anchors(real.html));
    expect(shown).toHaveLength(2);
    expect(shown[0]).toContain('>Verify email</a>');
  });

  it('matches the required-actions mail in the admin API pages', () => {
    const markdown = pagesText(ADMIN_PAGES);
    const block = /```\n(Update your [^|\n]+)\|([\s\S]*?)\n```/u.exec(markdown);
    if (block === null) throw new Error('no required-actions mail in the admin API pages');
    const [, subject = '', text = ''] = block;
    const codes = [...text.matchAll(/^- (.+)$/gmu)].map((line) => {
      const code = Object.keys(en)
        .filter((id) => id.startsWith('action.'))
        .find((id) => en[id as keyof typeof en] === line[1]);
      if (code === undefined) throw new Error(`no action worded ${line[1] ?? ''}`);
      return code.slice('action.'.length);
    });
    const real = renderRequiredActions({
      to: TO,
      link: linkOf(text),
      tenantDisplayName: tenantOf(text),
      now: sentAt(text),
      actions: codes,
    });
    expect(subject).toBe(real.subject);
    expect(text).toBe(real.text);
  });

  it('matches the two credential notices in the admin API pages', () => {
    const markdown = pagesText(ADMIN_PAGES);
    const notices = [
      ...markdown.matchAll(/^([a-z]+@example\.test)\|([^|\n]+)\|([\s\S]*?)\n```/gmu),
    ];
    expect(notices.length).toBeGreaterThanOrEqual(2);
    for (const [, to = '', subject = '', text = ''] of notices) {
      const common = { to, tenantDisplayName: tenantOf(text), now: sentAt(text) };
      const real = subject.startsWith('A sign-in method')
        ? renderSecondFactorRemoved({
            ...common,
            factor: text.includes('authenticator app') ? 'totp' : 'webauthn',
            codes: text.includes(en['factorRemoved.codes']),
          })
        : renderRecoveryCodesRevoked({
            ...common,
            newSet: text.includes(en['recoveryRevoked.newSet']),
          });
      expect(subject).toBe(real.subject);
      expect(text).toBe(real.text);
    }
  });

  it('shows an inline mark whose size is the PNG the sender attaches', () => {
    const markdown = pagesText(ADMIN_PAGES);
    const found = /\{"To":\[[^\n]*"Inline":(\[[^\n]*\])\}\n```/u.exec(markdown);
    if (found?.[1] === undefined) throw new Error('no Mailpit capture in the admin API pages');
    const [inline] = JSON.parse(found[1]) as {
      ContentID: string;
      ContentType: string;
      Size: number;
    }[];
    expect(inline?.ContentID).toBe('odudu-mark');
    expect(inline?.ContentType).toBe('image/png');
    expect(inline?.Size).toBe(Buffer.from(MARK_PNG_BASE64, 'base64').length);
  });
});

describe('the mail gallery', () => {
  const DIR = path.join(ROOT, 'docs/phases/p4g-mails');

  it('indexes every image it holds, and holds every image it indexes', async () => {
    const files = (await readdir(DIR)).filter((name) => name.endsWith('.webp')).sort();
    const index = await doc('phases/p4g.md');
    const listed = [...index.matchAll(/\]\(p4g-mails\/([^)]+\.webp)\)/gu)].map((m) => m[1] ?? '');
    expect([...new Set(listed)].sort()).toEqual(files);
    expect(files.length).toBeLessThanOrEqual(12);
    for (const file of files) {
      expect((await stat(path.join(DIR, file))).size, file).toBeLessThan(100 * 1024);
    }
  });
});
