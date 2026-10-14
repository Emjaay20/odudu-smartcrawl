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
});
