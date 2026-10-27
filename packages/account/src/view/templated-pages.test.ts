import {
  DEFAULT_PAGE_LOCALE,
  PAGE_KINDS,
  type PageLocale,
  type RenderedPage,
  type ResolvedBranding,
} from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { renderRegistrationForm } from '#/view/registration-html';
import { renderRequiredActionsForm } from '#/view/required-actions-html';
import { renderResetPasswordForm, renderResetRequestForm } from '#/view/reset-html';
import { DEFAULT_TEMPLATES, type TemplatedKind } from '#/view/templates/index';
import { renderEmailConfirmPage, renderVerificationSucceededPage } from '#/view/verification-html';

function themed(kind: TemplatedKind, template: string): PageLocale {
  const branding: ResolvedBranding = {
    origin: 'https://id.test',
    templates: { [kind]: template },
    tokensCss: '',
    stylesheetUrl: null,
    faviconUrl: null,
    logo: null,
    assetUrls: [],
  };
  return { ...DEFAULT_PAGE_LOCALE, branding };
}

const slots = (names: readonly string[]): string => names.map((name) => `{{${name}}}`).join('');

// A random nonce is the only part of a body that differs between two renders.
const stable = (page: RenderedPage): string => page.body.replace(/nonce="[^"]+"/gu, 'nonce="N"');

const RULES = {
  minLength: 12,
  requireDigit: true,
  requireUppercase: false,
  requireLowercase: false,
  requireSpecial: false,
};
const SIGN_IN = '/tenants/t1/protocol/openid-connect/auth?client_id=a';

interface Case {
  name: string;
  kind: TemplatedKind;
  render: (locale: PageLocale) => RenderedPage;
  // A template that places the parts in an order of its own, and what each
  // of them leaves in the markup, in the order the template asks for.
  template: string;
  inOrder: string[];
  // The inputs the form posts that the server, not a template, writes.
  hidden: string[];
}

const CASES: Case[] = [
  {
    name: 'registration',
    kind: 'registration',
    render: (locale) =>
      renderRegistrationForm(
        't1',
        { rules: RULES, signInPath: SIGN_IN, failure: { mismatch: true } },
        locale,
      ),
    template:
      '<div>{{links}}</div>{{error}}{{form.open}}{{fields}}{{submit}}{{form.close}}<p>{{intro}}</p>',
    inOrder: [
      'class="links"',
      'role="alert"',
      '<form',
      'name="username"',
      '<button type="submit"',
      '</form>',
      'class="intro"',
    ],
    hidden: ['return_to'],
  },
  {
    name: 'reset request',
    kind: 'reset',
    render: (locale) =>
      renderResetRequestForm('t1', { signInPath: SIGN_IN, emailRequired: true }, locale),
    template: '{{intro}}{{form.open}}{{fields}}{{submit}}{{form.close}}{{error}}{{links}}',
    inOrder: ['class="intro"', '<form', 'name="email"', '<button', '</form>', 'role="alert"'],
    hidden: ['return_to'],
  },
  {
    name: 'reset password',
    kind: 'reset',
    render: (locale) => renderResetPasswordForm('t1', 'key-1', 'required', RULES, locale),
    template: '{{error}}{{form.open}}{{submit}}{{fields}}{{form.close}}{{intro}}',
    inOrder: ['role="alert"', '<form', '<button', 'name="password"', '</form>', 'class="intro"'],
    hidden: ['key'],
  },
  {
    name: 'verification, confirm',
    kind: 'verification',
    render: (locale) => renderEmailConfirmPage('t1', 'key-1', 'ann', locale),
    template: '{{form.open}}{{submit}}{{form.close}}{{message}}',
    inOrder: ['<form', '<button', '</form>', '<h1>'],
    hidden: ['key'],
  },
  {
    name: 'verification, succeeded',
    kind: 'verification',
    render: (locale) => renderVerificationSucceededPage(SIGN_IN, locale),
    template: '{{links}}{{form.open}}{{submit}}{{form.close}}{{message}}',
    inOrder: ['class="links"', '<h1>'],
    hidden: [],
  },
  {
    name: 'required actions',
    kind: 'required-actions',
    render: (locale) =>
      renderRequiredActionsForm(
        't1',
        'key-1',
        ['update-password', 'configure-totp'],
        true,
        'required',
        RULES,
        locale,
      ),
    template: '{{error}}{{form.open}}{{fields}}{{submit}}{{form.close}}{{actions}}{{intro}}',
    inOrder: [
      'role="alert"',
      '<form',
      'name="password"',
      '<button',
      '</form>',
      'Your administrator asks you to:',
      'class="intro"',
    ],
    hidden: ['key'],
  },
];

function indexesIn(html: string, markers: readonly string[]): number[] {
  return markers.map((marker) => html.indexOf(marker));
}

describe.each(CASES)('the $name page', ({ kind, render, template, inOrder, hidden }) => {
  const manifest = PAGE_KINDS[kind];

  it('renders a theme template with its parts in the theme’s own order', () => {
    const body = render(themed(kind, template)).body;
    const at = indexesIn(body, inOrder);
    expect(
      at.every((index) => index >= 0),
      body,
    ).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('renders a template of the required parts alone without throwing', () => {
    const page = render(themed(kind, slots(manifest.required)));
    expect(page.body).not.toContain('{{');
  });

  it('supplies every part the manifest lists, so a template may place any of them', () => {
    const own = slots([...manifest.required, ...manifest.optional]);
    expect(render(themed(kind, own)).body).not.toContain('{{');
  });

  it('keeps every hidden input inside form.open, whatever the template holds', () => {
    if (hidden.length === 0) return;
    const body = render(themed(kind, slots(['form.open', 'form.close']))).body;
    for (const name of hidden) {
      expect(body.match(new RegExp(`type="hidden" name="${name}"`, 'gu')), name).toHaveLength(1);
    }
    const opening = body.indexOf('<form');
    const closing = body.indexOf('</form>');
    expect(body.slice(opening, closing)).toContain('type="hidden"');
  });

  it('falls back to the default when the theme’s template names an unknown part', () => {
    const own = themed(kind, `${slots(manifest.required)}{{nonesuch}}`);
    expect(stable(render(own))).toBe(stable(render(DEFAULT_PAGE_LOCALE)));
  });

  it('falls back to the default when the theme’s template names an unknown message', () => {
    const own = themed(kind, `${slots(manifest.required)}{{t "no.such.key"}}`);
    expect(stable(render(own))).toBe(stable(render(DEFAULT_PAGE_LOCALE)));
  });
});

describe.each(Object.keys(DEFAULT_TEMPLATES) as TemplatedKind[])(
  'the default template of %s',
  (kind) => {
    it('writes no input, form, script or button of its own', () => {
      expect(DEFAULT_TEMPLATES[kind]).not.toMatch(/<(?:input|form|script|button|iframe)/u);
    });
  },
);

describe('a page that fills an optional part with nothing', () => {
  it('renders a template that leaves the optional parts out', () => {
    const own = slots(PAGE_KINDS.registration.required);
    const page = renderRegistrationForm('t1', { rules: RULES }, themed('registration', own));
    expect(page.body).toContain('name="username"');
    expect(page.body).not.toContain('class="intro"');
  });

  it('fills the form parts of a verification page that has no form with nothing', () => {
    const locale = themed('verification', '[{{form.open}}][{{submit}}][{{form.close}}]{{message}}');
    const page = renderVerificationSucceededPage(null, locale);
    expect(page.body).toContain('[][][]<h1>');
    expect(page.body).not.toContain('<form');
  });
});

describe('the password script', () => {
  const render = (template: string): RenderedPage =>
    renderRegistrationForm('t1', { rules: RULES }, themed('registration', template));
  const names = ['form.open', 'submit', 'error', 'form.close'];

  it('travels with the fields it reads, wherever a theme places them', () => {
    for (const template of [
      slots(['fields', ...names]),
      slots([...names.slice(0, 2), ...names.slice(2), 'fields']),
    ]) {
      const body = render(template).body;
      const scripts = [...body.matchAll(/<script nonce="/gu)].map((match) => match.index);
      expect(scripts).toHaveLength(2);
      for (const id of ['id="password-rules"', 'id="password"', 'id="password-confirm"']) {
        expect(body.indexOf(id), id).toBeGreaterThanOrEqual(0);
        expect(body.indexOf(id), id).toBeLessThan(scripts[scripts.length - 1] ?? 0);
      }
    }
  });

  it('carries the nonce the page returns, on every script element', () => {
    const page = render(DEFAULT_TEMPLATES.registration);
    const nonce = page.script?.nonce ?? '';
    expect(nonce).not.toBe('');
    expect(page.body.split(`nonce="${nonce}"`)).toHaveLength(3);
  });
});

describe('a theme template that cannot be filled', () => {
  const told: [string, string][] = [];
  const spy = (kind: string, reason: string): number => told.push([kind, reason]);

  it('is reported with its kind and reason, and the default template is rendered', () => {
    told.length = 0;
    const locale = { ...themed('reset', '{{nonesuch}}'), templateFallback: spy };
    expect(renderResetRequestForm('t1', {}, locale).body).toBe(
      renderResetRequestForm('t1', {}, DEFAULT_PAGE_LOCALE).body,
    );
    expect(told).toEqual([['reset', 'unknown slot nonesuch']]);
  });

  it('is reported for an unknown message key, which saving does not check', () => {
    told.length = 0;
    const own = '{{message}}{{t "no.such.key"}}';
    const locale = { ...themed('verification', own), templateFallback: spy };
    renderVerificationSucceededPage(null, locale);
    expect(told).toEqual([['verification', 'unknown message no.such.key']]);
  });

  it('is not reported when it fills', () => {
    told.length = 0;
    const locale = {
      ...themed('verification', '{{message}}{{form.open}}{{submit}}{{form.close}}'),
      templateFallback: spy,
    };
    renderVerificationSucceededPage(null, locale);
    expect(told).toEqual([]);
  });
});
