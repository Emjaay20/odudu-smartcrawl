import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MARK_PNG_BASE64 } from '#/service/mark.generated';
import {
  renderRecoveryCodesRevoked,
  renderRequiredActions,
  renderSecondFactorRemoved,
  renderResetPassword,
  renderSmtpTest,
  renderVerifyEmail,
} from '#/service/templates';

// Writes every kind of mail, as a browser would show it, to the directory
// given: `node scripts/preview.ts <dir>`. The inline mark is swapped for a
// data URI so the file opens on its own.
const out = process.argv[2];
if (out === undefined) throw new Error('usage: node scripts/preview.ts <dir>');

const now = new Date('2026-10-19T09:00:00Z');
const link =
  'https://idp.example.test/tenants/northwind/login-actions/action-token?key=Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6';
const to = 'ada@example.test';
const tenantDisplayName = 'Northwind Trading';
const common = { to, link, tenantDisplayName, now };

const mails = {
  verification: renderVerifyEmail(common),
  'password-reset': renderResetPassword(common),
  'required-actions': renderRequiredActions({
    ...common,
    actions: ['update-password', 'configure-totp', 'generate-recovery-codes'],
  }),
  'factor-removed': renderSecondFactorRemoved({
    to,
    tenantDisplayName,
    now,
    factor: 'totp',
    codes: true,
  }),
  'recovery-revoked': renderRecoveryCodesRevoked({ to, tenantDisplayName, now, newSet: true }),
  'smtp-test': renderSmtpTest({ to, tenantDisplayName, now }),
  'verification-long-name': renderVerifyEmail({
    ...common,
    tenantDisplayName: `${'Northwind International Holdings '.repeat(4)}${'x'.repeat(60)}`,
  }),
  'verification-rtl': renderVerifyEmail({
    ...common,
    tenantDisplayName: 'شركة المثال للتجارة',
  }),
};

await mkdir(out, { recursive: true });
const inline = `data:image/png;base64,${MARK_PNG_BASE64}`;
await Promise.all(
  Object.entries(mails).map(async ([name, mail]) => {
    await writeFile(join(out, `${name}.html`), mail.html.replace('cid:odudu-mark', inline));
    await writeFile(join(out, `${name}.txt`), `${mail.subject}\n\n${mail.text}\n`);
  }),
);
process.stdout.write(`${String(Object.keys(mails).length)} mails written to ${out}\n`);
