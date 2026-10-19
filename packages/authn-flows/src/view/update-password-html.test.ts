import { describe, expect, it } from 'vitest';
import { renderUpdatePasswordPage } from '#/view/update-password-html';

describe('renderUpdatePasswordPage', () => {
  it('posts the new password to the update-password action with the session it was given', () => {
    const rendered = renderUpdatePasswordPage('demo', 'sess-1');
    expect(rendered.html).toContain(
      'action="/tenants/demo/login-actions/required-action?action=update-password"',
    );
    expect(rendered.html).toContain('name="auth_session_id" value="sess-1"');
    expect(rendered.html).toContain('autocomplete="new-password"');
    expect(rendered.title).toBe('Change your password');
    expect(rendered.script).toBeNull();
  });

  it('lists every violation it was given and none when there are none', () => {
    expect(renderUpdatePasswordPage('demo', 's').html).not.toContain('<ul>');
    const listed = renderUpdatePasswordPage('demo', 's', ['Too short', 'Too common']).html;
    expect(listed).toContain('<li>Too short</li>');
    expect(listed).toContain('<li>Too common</li>');
  });

  it('escapes the tenant, the session and each violation', () => {
    const { html } = renderUpdatePasswordPage('<b>t</b>', '"><i>', ['<img src=x onerror=1>']);
    expect(html).not.toContain('<b>t</b>');
    expect(html).not.toContain('"><i>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
  });
});
