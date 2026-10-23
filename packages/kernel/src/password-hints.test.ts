import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  PASSWORD_HINTS_SCRIPT,
  passwordHints,
  type PasswordHintText,
  type PasswordRules,
} from '#/password-hints';

const TEXT: PasswordHintText = {
  heading: 'Your password needs',
  minLength: 'At least 15 characters',
  digit: 'A digit',
  uppercase: 'An uppercase letter',
  lowercase: 'A lowercase letter',
  special: 'A special character',
  notCommon: 'Not a common password',
  show: 'Show password',
  summary: '{met} of {total} rules met',
};

const NONE: PasswordRules = {
  minLength: 15,
  requireDigit: false,
  requireUppercase: false,
  requireLowercase: false,
  requireSpecial: false,
};

function items(markup: string): string[] {
  return [...markup.matchAll(/<li[^>]*>(.*?)<\/li>/gu)].map((match) => match[1] ?? '');
}

describe('passwordHints', () => {
  it('lists the length and the common-password rule, and no rule the tenant has not enabled', () => {
    const { markup } = passwordHints(NONE, TEXT);
    expect(items(markup)).toEqual(['At least 15 characters', 'Not a common password']);
  });

  it('adds each enabled character rule as a line of its own', () => {
    const { markup } = passwordHints(
      {
        ...NONE,
        requireDigit: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSpecial: true,
      },
      TEXT,
    );
    expect(items(markup)).toEqual([
      'At least 15 characters',
      'A digit',
      'An uppercase letter',
      'A lowercase letter',
      'A special character',
      'Not a common password',
    ]);
  });

  it('is a plain list before any script runs, with the toggle hidden', () => {
    const { markup } = passwordHints(NONE, TEXT);
    expect(markup).toContain('<ul id="password-rules-list">');
    expect(markup).toMatch(/<button type="button" class="quiet"[^>]* hidden/u);
    expect(markup).toContain('data-min="15"');
  });

  it('keeps the toggle label fixed, with its state in aria-pressed alone', () => {
    const { markup } = passwordHints(NONE, TEXT);
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('>Show password</button>');
    expect(markup).not.toContain('data-hide');
  });

  it('carries one polite status line, empty until the script has something to say', () => {
    const { markup } = passwordHints(NONE, TEXT);
    expect(markup).toContain('<span role="status"></span>');
    expect(markup).toContain('data-summary="{met} of {total} rules met"');
    expect(markup).not.toContain('aria-live');
  });

  it('keeps autocorrect, spellcheck and capitals away from the field, which can be shown', () => {
    const { field } = passwordHints(NONE, TEXT);
    expect(field).toContain('spellcheck="false"');
    expect(field).toContain('autocapitalize="off"');
    expect(field).toContain('autocorrect="off"');
    expect(field).toContain('id="password"');
    expect(field).toContain('minlength="15"');
  });

  it('carries the one nonce its script element names, and declares it', () => {
    const { markup, script } = passwordHints(NONE, TEXT);
    expect(script.fetchesSameOrigin).toBe(false);
    expect(markup).toContain(`<script nonce="${script.nonce}">`);
    expect(passwordHints(NONE, TEXT).script.nonce).not.toBe(script.nonce);
  });

  it('keeps its script under 1.5 KB and free of any request', () => {
    expect(Buffer.byteLength(PASSWORD_HINTS_SCRIPT)).toBeLessThan(1500);
    expect(PASSWORD_HINTS_SCRIPT).not.toMatch(/fetch|XMLHttpRequest|WebSocket|import\(|eval/u);
  });
});

// The smallest document the script touches.
function run(rules: PasswordRules, value: string) {
  const { markup } = passwordHints(rules, TEXT);
  const rows = [...markup.matchAll(/<li data-rule="(\w+)"/gu)].map((match) => match[1] ?? '');
  const met: Record<string, string | null> = Object.fromEntries(rows.map((row) => [row, null]));
  const listeners: Record<string, () => void> = {};
  const timers: (() => void)[] = [];
  const attributes = new Map<string, string>([
    ['data-min', String(rules.minLength)],
    ['data-summary', TEXT.summary],
  ]);
  const field = {
    value,
    type: 'password',
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn;
    },
  };
  const toggle = {
    hidden: true,
    textContent: 'Show password',
    attributes: new Map<string, string>(),
    setAttribute(name: string, to: string) {
      this.attributes.set(name, to);
    },
    addEventListener: (name: string, fn: () => void) => {
      listeners[`toggle-${name}`] = fn;
    },
  };
  const status = { textContent: '' };
  const box = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    querySelectorAll: () =>
      rows.map((row) => ({
        getAttribute: () => row,
        setAttribute: (_name: string, to: string) => {
          met[row] = to;
        },
      })),
    querySelector: (selector: string) => (selector === 'button' ? toggle : status),
  };
  runInNewContext(PASSWORD_HINTS_SCRIPT, {
    document: {
      getElementById: (id: string) =>
        id === 'password-rules' ? box : id === 'password' ? field : null,
    },
    Array,
    Number,
    String,
    setTimeout: (fn: () => void) => timers.push(fn),
    clearTimeout: () => {
      timers.length = 0;
    },
  });
  return {
    met,
    status,
    toggle,
    field,
    type: () => {
      listeners.input?.();
    },
    settle: () => {
      for (const fn of timers.splice(0)) fn();
    },
    press: () => {
      listeners['toggle-click']?.();
    },
  };
}

describe('the live check', () => {
  const all: PasswordRules = {
    minLength: 10,
    requireDigit: true,
    requireUppercase: true,
    requireLowercase: true,
    requireSpecial: true,
  };
  const lengthOnly = { ...all, requireDigit: false, requireUppercase: false };

  it('marks each rule met or not as the value is typed', () => {
    const good = run(all, 'Abcdefghi1!');
    good.type();
    expect(good.met).toEqual({
      length: 'true',
      digit: 'true',
      uppercase: 'true',
      lowercase: 'true',
      special: 'true',
    });
    const poor = run(all, 'abc');
    poor.type();
    expect(poor.met).toEqual({
      length: 'false',
      digit: 'false',
      uppercase: 'false',
      lowercase: 'true',
      special: 'false',
    });
  });

  it('counts the length in code points, after normalising, as the server does', () => {
    const only = { ...lengthOnly, requireLowercase: false, requireSpecial: false };
    for (const [value, expected] of [
      ['\u{1f511}'.repeat(10), 'true'],
      ['\u{1f511}'.repeat(9), 'false'],
      ['é'.repeat(9), 'false'],
      ['é'.repeat(10), 'true'],
    ] as const) {
      const page = run(only, value);
      page.type();
      expect(page.met.length).toBe(expected);
    }
  });

  it('says nothing at load, then one short summary after typing pauses', () => {
    const page = run(all, 'Abcdefghij1');
    expect(page.status.textContent).toBe('');
    page.type();
    page.type();
    expect(page.status.textContent).toBe('');
    page.settle();
    expect(page.status.textContent).toBe('4 of 5 rules met');
  });

  it('shows the toggle and flips the field without changing the label', () => {
    const page = run(all, '');
    expect(page.toggle.hidden).toBe(false);
    page.press();
    expect(page.field.type).toBe('text');
    expect(page.toggle.attributes.get('aria-pressed')).toBe('true');
    expect(page.toggle.textContent).toBe('Show password');
    page.press();
    expect(page.field.type).toBe('password');
    expect(page.toggle.attributes.get('aria-pressed')).toBe('false');
  });
});
