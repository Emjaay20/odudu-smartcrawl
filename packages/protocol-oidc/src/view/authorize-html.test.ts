import { describe, expect, it } from 'vitest';
import {
  renderAuthorizeErrorPage,
  renderEmailUnverifiedPage,
  renderLoginForm,
} from '#/view/authorize-html';

describe('renderAuthorizeErrorPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderAuthorizeErrorPage('invalid_request', 'missing redirect_uri');
    expect(page.title).toBe('Sign-in error');
    expect(page.body).toContain('invalid_request');
    // The fragment is a fragment: a theme that wraps it must not find a
    // second document inside it.
    expect(page.body).not.toContain('<!doctype');
    expect(page.body).not.toContain('<html');
    // The assembled document still carries everything it carries today.
    expect(page.html).toContain('<!doctype html>');
    expect(page.html).toContain(page.body);
  });
});

describe('renderAuthorizeErrorPage with a way on', () => {
  it('offers a restart link to the given location, and carries no script', () => {
    const page = renderAuthorizeErrorPage('invalid_request', 'expired', {
      kind: 'restart',
      href: '/tenants/acme/auth?a=1',
    });
    expect(page.body).toContain('<a href="/tenants/acme/auth?a=1">Start sign-in again</a>');
    expect(page.script).toBeNull();
    expect(page.body).not.toContain('<script');
  });

  it('offers a return to the application under its own label', () => {
    const page = renderAuthorizeErrorPage('invalid_request', 'expired', {
      kind: 'return',
      href: 'https://app.example/cb?error=access_denied',
    });
    expect(page.body).toContain(
      '<a href="https://app.example/cb?error=access_denied">Return to the application</a>',
    );
    expect(page.body).not.toContain('Start sign-in again');
  });

  it('escapes the location it was given', () => {
    const page = renderAuthorizeErrorPage('invalid_request', 'x', {
      kind: 'restart',
      href: '/auth?a=1&b="><script>x</script>',
    });
    expect(page.body).toContain('href="/auth?a=1&amp;b=&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
    expect(page.body).not.toContain('<script');
  });

  it('offers no link when there is nothing to go on to', () => {
    expect(renderAuthorizeErrorPage('invalid_request', 'x').body).not.toContain('<a ');
  });
});

describe('renderEmailUnverifiedPage', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderEmailUnverifiedPage(true);
    expect(page.title).toBe('Verify your email');
    expect(page.body).toContain('verify your email');
    expect(page.body).not.toContain('<!doctype');
    expect(page.body).not.toContain('<html');
    expect(page.html).toContain('<!doctype html>');
    expect(page.html).toContain(page.body);
  });
});

describe('renderLoginForm', () => {
  it('returns a body fragment and a title beside the document', () => {
    const page = renderLoginForm('acme', 'session-id', 'password');
    expect(page.title).toBe('Sign in');
    expect(page.body).toContain('name="username"');
    expect(page.body).not.toContain('<!doctype');
    expect(page.body).not.toContain('<html');
    expect(page.html).toContain('<!doctype html>');
    expect(page.html).toContain(page.body);
  });

  it('titles the second-factor form for what it asks, not as a second sign-in', () => {
    const otp = renderLoginForm('acme', 'session-id', 'otp');
    expect(otp.title).toBe('Enter your authentication code');
    expect(otp.body).toContain('name="code"');
    expect(otp.body).toContain('<button type="submit">Verify</button>');
    expect(otp.body).not.toContain('Sign in');
    const recovery = renderLoginForm('acme', 'session-id', 'recovery-code');
    expect(recovery.title).toBe('Enter a recovery code');
    expect(recovery.body).toContain('<button type="submit">Verify</button>');
  });

  it('offers remember me when the tenant allows it', () => {
    const page = renderLoginForm('acme', 'session-id', 'password', false, true);
    expect(page.body).toContain(
      '<input type="checkbox" name="remember_me" id="remember-me" value="true">',
    );
    expect(page.body).toContain('Remember me');
  });

  it('offers nothing when the tenant does not allow it', () => {
    const page = renderLoginForm('acme', 'session-id', 'password', false, false);
    expect(page.body).not.toContain('remember_me');
  });

  // The tenant name is the one request-derived value this page interpolates
  // into markup at all — the form's own `action` — so it is escaped like any
  // other. Exercised here directly against the pure renderer rather than
  // through a stored tenant, since a name shaped like this can no longer
  // reach a row (tenants_name_dns_label,
  // packages/db/drizzle/0072_tenant_name_rule.sql).
  it('escapes a tenant name that is not a DNS label', () => {
    const page = renderLoginForm('esc"><script>alert(1)<x', 'session-id', 'password');
    expect(page.body).not.toContain('<script>');
    expect(page.body).toContain('&lt;script&gt;');
    expect(page.body).toContain('&quot;&gt;');
  });

  describe('after a refusal', () => {
    const refusal = { message: 'Sign-in failed. Check your details and try again.' };

    it('puts the message in an alert above the form', () => {
      const page = renderLoginForm('acme', 'session-id', 'password', false, false, refusal);
      expect(page.body).toContain(
        '<p role="alert"><strong>Sign-in failed. Check your details and try again.</strong></p>',
      );
      expect(page.body.indexOf('role="alert"')).toBeLessThan(page.body.indexOf('<form'));
    });

    it('shows no alert without a refusal', () => {
      expect(renderLoginForm('acme', 'session-id', 'password').body).not.toContain('role="alert"');
    });

    it('escapes the message', () => {
      const page = renderLoginForm('acme', 'sid', 'password', false, false, {
        message: '<img src=x onerror=alert(1)>',
      });
      expect(page.body).not.toContain('<img');
    });

    it('gives the username back and moves focus to the empty password field', () => {
      const page = renderLoginForm('acme', 'sid', 'password', false, false, {
        ...refusal,
        username: 'ada',
      });
      expect(page.body).toContain('name="username" autocomplete="username" value="ada"');
      expect(page.body).toMatch(/name="password"[^>]*autofocus/u);
      expect(page.body).not.toMatch(/name="username"[^>]*autofocus/u);
    });

    it('focuses the username when there is none to give back', () => {
      const page = renderLoginForm('acme', 'sid', 'password', false, false, refusal);
      expect(page.body).toMatch(/name="username"[^>]*autofocus/u);
      expect(page.body).not.toContain('value=""');
    });

    it('never puts anything but the username into a value attribute', () => {
      const page = renderLoginForm('acme', 'sid', 'password', false, true, {
        ...refusal,
        username: 'ada',
      });
      expect(page.body.match(/ value="[^"]*"/gu)).toEqual([
        ' value="sid"',
        ' value="ada"',
        ' value="true"',
      ]);
    });

    it.each([
      ['a double quote', 'a"b'],
      ['a single quote', "a'b"],
      ['a tag', '<b>x</b>'],
      ['an ampersand', 'a&amp;b'],
      ['a closing script', '</script><script>alert(1)</script>'],
      ['unicode', 'Zoë 名前 🙂'],
      ['a bidi override', 'ada\u202Eevil'],
    ])('escapes %s in the username it gives back', (_name, username) => {
      const page = renderLoginForm('acme', 'sid', 'password', false, false, {
        ...refusal,
        username,
      });
      const echoed = /name="username"[^>]* value="([^"]*)"/u.exec(page.body)?.[1] ?? '';
      expect(echoed).not.toMatch(/[<>"']/u);
      expect(page.body).not.toContain('<script');
      expect(page.body).not.toContain('<b>');
      expect(
        echoed
          .replaceAll('&amp;', '&')
          .replaceAll('&#39;', "'")
          .replaceAll('&lt;', '<')
          .replaceAll('&gt;', '>')
          .replaceAll('&quot;', '"'),
      ).toBe(username);
    });

    it('does not reflect a username longer than any account has', () => {
      const page = renderLoginForm('acme', 'sid', 'password', false, false, {
        ...refusal,
        username: 'a'.repeat(1_000_000),
      });
      expect(page.html.length).toBeLessThan(5_000);
      expect(page.body).toContain('role="alert"');
      expect(page.body).toMatch(/name="username"[^>]*autofocus/u);
    });

    it('asks for a code with focus on the code field, and gives back nothing', () => {
      const otp = renderLoginForm('acme', 'sid', 'otp', false, false, {
        message: 'That code did not work. Check it and try again.',
        username: 'ada',
      });
      expect(otp.body).toMatch(/name="code"[^>]*autofocus/u);
      expect(otp.body.match(/autofocus/gu)).toHaveLength(1);
      expect(otp.body).not.toContain('ada');
      const recovery = renderLoginForm('acme', 'sid', 'recovery-code', false, false, refusal);
      expect(recovery.body).toMatch(/name="recovery_code"[^>]*autofocus/u);
    });

    it('does not focus a field when nothing was refused', () => {
      expect(renderLoginForm('acme', 'sid', 'password').body).not.toContain('autofocus');
      expect(renderLoginForm('acme', 'sid', 'otp').body).not.toContain('autofocus');
    });
  });
});
