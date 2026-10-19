import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  renderRequiredActions,
  renderResetPassword,
  renderVerifyEmail,
} from '../../packages/email/src/service/templates.js';
import { en } from '../../packages/email/src/service/messages.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const doc = (name: string): Promise<string> => readFile(path.join(ROOT, 'docs', name), 'utf8');

const ABBREVIATED_ANCHOR = '<a href="…">…</a>';
const TO = 'recipient@example.test';

function linkOf(text: string): string {
  const found = /\n\n(http\S+)\n\n/u.exec(text)?.[1];
  if (found === undefined) throw new Error(`no link in ${text}`);
  return found;
}

// Each pino capture is one JSON object; the guides show some as a reduced
// object, with the anchor's href and text elided to an ellipsis.
interface Capture {
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
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
    const { subject, text, html } = parsed as Record<string, unknown>;
    if (typeof subject !== 'string' || typeof text !== 'string') continue;
    const line = markdown.slice(0, block.index).split('\n').length;
    found.push({ subject, text, html: typeof html === 'string' ? html : null, line });
  }
  return found;
}

function rendered(capture: Capture) {
  const link = linkOf(capture.text);
  const tenant = /for ⁨(.+?)⁩/u.exec(capture.text)?.[1];
  if (tenant === undefined) throw new Error(`no isolated tenant in ${capture.text}`);
  const input = { to: TO, link, tenantDisplayName: tenant };
  return capture.subject.startsWith('Reset')
    ? renderResetPassword(input)
    : renderVerifyEmail(input);
}

describe('the mail the guides record is what the templates produce', () => {
  it('matches every captured verification and reset mail in request-paths.md', async () => {
    const found = captures(await doc('request-paths.md'));
    expect(found.length).toBeGreaterThanOrEqual(4);
    for (const capture of found) {
      const real = rendered(capture);
      expect(capture.subject, `line ${String(capture.line)}`).toBe(real.subject);
      expect(capture.text, `line ${String(capture.line)}`).toBe(real.text);
      if (capture.html !== null) {
        const expanded = capture.html.replace(
          ABBREVIATED_ANCHOR,
          `<a href="${linkOf(capture.text)}">${linkOf(capture.text)}</a>`,
        );
        expect(expanded, `line ${String(capture.line)}`).toBe(real.html);
      }
    }
  });

  it('matches the required-actions mail in admin-paths.md', async () => {
    const markdown = await doc('admin-paths.md');
    const block = /```\n(Update your [^|\n]+)\|([\s\S]*?)\n```/u.exec(markdown);
    if (block === null) throw new Error('no required-actions mail in admin-paths.md');
    const [, subject = '', text = ''] = block;
    const tenant = /⁨(.+?)⁩/u.exec(text)?.[1] ?? '';
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
      tenantDisplayName: tenant,
      actions: codes,
    });
    expect(subject).toBe(real.subject);
    expect(text).toBe(real.text);
  });
});
