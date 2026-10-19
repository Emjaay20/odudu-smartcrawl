import { describe, expect, it, vi } from 'vitest';
import { en } from '#/service/messages';
import { renderRequiredActions, renderResetPassword, renderVerifyEmail } from '#/service/templates';

vi.mock('#/service/messages', async (importOriginal) => {
  const { withFrench } = await import('@odudu/testkit/i18n');
  return withFrench(await importOriginal(), {
    'verify.subject': 'Vérifiez votre compte {tenant}',
    'verify.text': 'Confirmez votre adresse e-mail pour {tenant} en ouvrant ce lien :',
    'verify.html': 'Confirmez votre adresse e-mail pour {tenant} en ouvrant {link}.',
    'reset.subject': 'Réinitialisez votre mot de passe {tenant}',
    'actions.subject': 'Mettez à jour votre compte {tenant}',
    'action.update-password': 'Choisir un nouveau mot de passe',
  });
});

const LINK = 'https://idp.example/tenants/demo/login-actions/action-token?key=abc';
const FSI = '\u2068';
const PDI = '\u2069';

function fill(message: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (out, [name, value]) => out.replaceAll(`{${name}}`, value),
    message,
  );
}

describe('renderVerifyEmail', () => {
  const input = { to: 'ada@example.test', link: LINK, tenantDisplayName: 'Demo' };

  it('reads subject, text and html from the catalogue', () => {
    const msg = renderVerifyEmail(input);
    expect(msg.to).toBe('ada@example.test');
    expect(msg.subject).toBe(fill(en['verify.subject'], { tenant: 'Demo' }));
    expect(msg.text).toBe(
      `${fill(en['verify.text'], { tenant: `${FSI}Demo${PDI}` })}\n\n${LINK}\n\n${en['mail.notRequested']}`,
    );
    expect(msg.html).toBe(
      `<p>${fill(en['verify.html'], {
        tenant: '<bdi>Demo</bdi>',
        link: `<a href="${LINK}">${LINK}</a>`,
      })}</p><p>${en['mail.notRequested']}</p>`,
    );
  });

  it('keeps the English mail as it was, the tenant name isolated', () => {
    const msg = renderVerifyEmail(input);
    expect(msg.subject).toBe('Verify your Demo account');
    expect(msg.text).toBe(
      `Confirm your email address for ${FSI}Demo${PDI} by visiting this link:\n\n${LINK}\n\nIf you did not request this, you can ignore this message.`,
    );
    expect(msg.html).toBe(
      `<p>Confirm your email address for <bdi>Demo</bdi> by visiting <a href="${LINK}">${LINK}</a>.</p><p>If you did not request this, you can ignore this message.</p>`,
    );
  });

  it('defaults to English when no locale is given, or none is held', () => {
    const english = renderVerifyEmail(input);
    for (const locale of [undefined, null, 'de', 'not a tag', 'zh-Hant-TW']) {
      expect(renderVerifyEmail({ ...input, locale })).toEqual(english);
    }
  });

  it('reads French where the fixture has it and English for the rest', () => {
    const msg = renderVerifyEmail({ ...input, locale: 'fr' });
    expect(msg.subject).toBe('Vérifiez votre compte Demo');
    expect(msg.text).toBe(
      `Confirmez votre adresse e-mail pour ${FSI}Demo${PDI} en ouvrant ce lien :\n\n${LINK}\n\n${en['mail.notRequested']}`,
    );
    expect(msg.html).toBe(
      `<p>Confirmez votre adresse e-mail pour <bdi>Demo</bdi> en ouvrant <a href="${LINK}">${LINK}</a>.</p><p>${en['mail.notRequested']}</p>`,
    );
  });

  it('matches a regional tag to the language it holds', () => {
    expect(renderVerifyEmail({ ...input, locale: 'fr-CA' }).subject).toBe(
      'Vérifiez votre compte Demo',
    );
  });

  it('never escapes the link and never takes it from the catalogue', () => {
    const link = 'https://idp.example/x?key=a&b=c';
    const msg = renderVerifyEmail({ ...input, link });
    expect(msg.html).toContain(`<a href="${link}">${link}</a>`);
    expect(msg.text).toContain(`\n\n${link}\n\n`);
  });

  it('escapes a tenant name that contains markup, and leaves it as typed in the text', () => {
    const msg = renderVerifyEmail({ ...input, tenantDisplayName: '<script>x</script> & "q"' });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('<bdi>&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot;</bdi>');
    expect(msg.text).toContain(`${FSI}<script>x</script> & "q"${PDI}`);
    expect(msg.subject).toBe('Verify your <script>x</script> & "q" account');
  });

  it('strips bidi controls from the subject, because a header cannot carry an isolate', () => {
    const msg = renderVerifyEmail({ ...input, tenantDisplayName: 'Acme\u202eGP\u2066x\u2069' });
    expect(msg.subject).toBe('Verify your AcmeGPx account');
  });

  it('cannot close its own isolate: the text holds the one pop it wrote', () => {
    const msg = renderVerifyEmail({
      ...input,
      tenantDisplayName: `evil${PDI} \u202e injected`,
    });
    expect(msg.text.split(PDI)).toHaveLength(2);
    expect(msg.text).not.toContain('\u202e');
    expect(msg.html).not.toContain('\u202e');
  });

  it('never lets a name put a line break into the subject or start a line in the text', () => {
    const hostile = 'Acme\r\nBcc: evil@example.test\u2028more\u0085x\u0000y';
    const msg = renderVerifyEmail({ ...input, tenantDisplayName: hostile });
    expect(msg.subject).not.toMatch(/[\r\n\u2028\u2029\u0085\u0000]/u);
    expect(msg.subject).toBe('Verify your Acme Bcc: evil@example.test more x y account');
    const [first = ''] = msg.text.split('\n');
    expect(first).toContain('Acme Bcc: evil@example.test more x y');
    expect(msg.text.split('\n')).toHaveLength(5);
  });

  it('cannot reach the link through a name that spells a placeholder', () => {
    const msg = renderVerifyEmail({ ...input, tenantDisplayName: '{link} {tenant}' });
    expect(msg.html).toContain('<bdi>{link} {tenant}</bdi>');
    expect(msg.html.match(/<a href=/gu)).toHaveLength(1);
  });

  it('isolates a right-to-left tenant name and leaves its marks alone', () => {
    const msg = renderVerifyEmail({ ...input, tenantDisplayName: 'شركة\u200f' });
    expect(msg.html).toContain('<bdi>شركة\u200f</bdi>');
    expect(msg.text).toContain(`${FSI}شركة\u200f${PDI}`);
  });
});

describe('renderResetPassword', () => {
  const input = { to: 'ada@example.test', link: LINK, tenantDisplayName: 'Demo' };

  it('reads subject, text and html from the catalogue', () => {
    const msg = renderResetPassword(input);
    expect(msg.subject).toBe(fill(en['reset.subject'], { tenant: 'Demo' }));
    expect(msg.text).toBe(
      `${fill(en['reset.text'], { tenant: `${FSI}Demo${PDI}` })}\n\n${LINK}\n\n${en['mail.notRequested']}`,
    );
    expect(msg.html).toBe(
      `<p>${fill(en['reset.html'], {
        tenant: '<bdi>Demo</bdi>',
        link: `<a href="${LINK}">${LINK}</a>`,
      })}</p><p>${en['mail.notRequested']}</p>`,
    );
  });

  it('keeps the English mail as it was, the tenant name isolated', () => {
    const msg = renderResetPassword(input);
    expect(msg.subject).toBe('Reset your Demo password');
    expect(msg.text).toBe(
      `Reset your password for ${FSI}Demo${PDI} by visiting this link:\n\n${LINK}\n\nIf you did not request this, you can ignore this message.`,
    );
    expect(msg.html).toBe(
      `<p>Reset your password for <bdi>Demo</bdi> by visiting <a href="${LINK}">${LINK}</a>.</p><p>If you did not request this, you can ignore this message.</p>`,
    );
  });

  it('reads French for the subject and English for the keys the fixture lacks', () => {
    const msg = renderResetPassword({ ...input, locale: 'fr' });
    expect(msg.subject).toBe('Réinitialisez votre mot de passe Demo');
    expect(msg.text).toContain('Reset your password for');
  });

  it('escapes a tenant name that contains markup', () => {
    const msg = renderResetPassword({ ...input, tenantDisplayName: '<script>alert(1)</script>' });
    expect(msg.html).not.toContain('<script>');
  });

  it('strips CR, LF and bidi controls from the subject', () => {
    const msg = renderResetPassword({
      ...input,
      tenantDisplayName: 'A\r\nSubject: x\u202e',
    });
    expect(msg.subject).toBe('Reset your A Subject: x password');
  });
});

describe('renderRequiredActions', () => {
  const input = {
    to: 'ada@example.test',
    link: LINK,
    tenantDisplayName: 'Demo',
    actions: ['update-password', 'configure-passkey'],
  };

  it('reads subject, intro, each action and the closing lines from the catalogue', () => {
    const msg = renderRequiredActions(input);
    expect(msg.subject).toBe(fill(en['actions.subject'], { tenant: 'Demo' }));
    expect(msg.text).toBe(
      `${fill(en['actions.text'], { tenant: `${FSI}Demo${PDI}` })}\n\n- ${en['action.update-password']}\n- ${en['action.configure-passkey']}\n\n${en['actions.textLink']}\n\n${LINK}\n\n${en['actions.ignore']}`,
    );
    expect(msg.html).toBe(
      `<p>${fill(en['actions.text'], { tenant: '<bdi>Demo</bdi>' })}</p><ul><li>${en['action.update-password']}</li><li>${en['action.configure-passkey']}</li></ul><p>${fill(
        en['actions.html'],
        { link: `<a href="${LINK}">${LINK}</a>` },
      )}</p><p>${en['actions.ignore']}</p>`,
    );
  });

  it('keeps the English mail as it was, the tenant name isolated', () => {
    const msg = renderRequiredActions(input);
    expect(msg.subject).toBe('Update your Demo account');
    expect(msg.text).toBe(
      `Your administrator asks you to update your ${FSI}Demo${PDI} account:\n\n- Choose a new password\n- Register a passkey\n\nDo so by visiting this link:\n\n${LINK}\n\nIf you were not expecting this, you can ignore this message.`,
    );
    expect(msg.html).toBe(
      `<p>Your administrator asks you to update your <bdi>Demo</bdi> account:</p><ul><li>Choose a new password</li><li>Register a passkey</li></ul><p>Do so by visiting <a href="${LINK}">${LINK}</a>.</p><p>If you were not expecting this, you can ignore this message.</p>`,
    );
  });

  it('reads an action in French where the fixture has it', () => {
    const msg = renderRequiredActions({ ...input, locale: 'fr' });
    expect(msg.subject).toBe('Mettez à jour votre compte Demo');
    expect(msg.text).toContain('- Choisir un nouveau mot de passe\n- Register a passkey');
    expect(msg.html).toContain(
      '<li>Choisir un nouveau mot de passe</li><li>Register a passkey</li>',
    );
  });

  it('shows an action code this build has no sentence for, isolated and escaped', () => {
    const msg = renderRequiredActions({ ...input, actions: ['update-password', '<b>weird'] });
    expect(msg.html).toContain('<li><bdi>&lt;b&gt;weird</bdi></li>');
    expect(msg.html).not.toContain('<b>');
    expect(msg.text).toContain(`- ${FSI}<b>weird${PDI}`);
  });

  it('keeps an action code from taking another message by naming its id', () => {
    const msg = renderRequiredActions({ ...input, actions: ['x', 'verify.subject'] });
    expect(msg.text).toContain(`- ${FSI}x${PDI}\n- ${FSI}verify.subject${PDI}`);
  });

  it('escapes the tenant name and strips bidi controls from the subject', () => {
    const msg = renderRequiredActions({ ...input, tenantDisplayName: 'Demo <Co>\u202e' });
    expect(msg.html).not.toContain('<Co>');
    expect(msg.subject).toBe('Update your Demo <Co> account');
  });
});
