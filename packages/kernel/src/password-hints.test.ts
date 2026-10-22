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
  hide: 'Hide password',
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
function run(rules: PasswordRules, value: string): { met: Record<string, string | null> } {
  const { markup } = passwordHints(rules, TEXT);
  const rows = [...markup.matchAll(/<li data-rule="(\w+)"/gu)].map((match) => match[1] ?? '');
  const met: Record<string, string | null> = Object.fromEntries(rows.map((row) => [row, null]));
  const listeners: Record<string, () => void> = {};
  const attributes = new Map<string, string>([['data-min', String(rules.minLength)]]);
  const field = {
    value,
    type: 'password',
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn;
    },
  };
  const toggle = {
    hidden: true,
    textContent: '',
    attributes: new Map<string, string>([
      ['data-show', 'Show password'],
      ['data-hide', 'Hide password'],
    ]),
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    },
    setAttribute(name: string, to: string) {
      this.attributes.set(name, to);
    },
    addEventListener: (name: string, fn: () => void) => {
      listeners[`toggle-${name}`] = fn;
    },
  };
  const box = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, to: string) => attributes.set(name, to),
    querySelectorAll: () =>
      rows.map((row) => ({
        getAttribute: () => row,
        setAttribute: (_name: string, to: string) => {
          met[row] = to;
        },
      })),
    querySelector: () => toggle,
  };
  runInNewContext(PASSWORD_HINTS_SCRIPT, {
    document: {
      getElementById: (id: string) =>
        id === 'password-rules' ? box : id === 'password' ? field : null,
    },
    Array,
    Number,
    String,
  });
  listeners.input?.();
  return { met };
}

describe('the live check', () => {
  const all: PasswordRules = {
    minLength: 10,
    requireDigit: true,
    requireUppercase: true,
    requireLowercase: true,
    requireSpecial: true,
  };

  it('marks each rule met or not as the value is typed', () => {
    expect(run(all, 'Abcdefghi1!').met).toEqual({
      length: 'true',
      digit: 'true',
      uppercase: 'true',
      lowercase: 'true',
      special: 'true',
    });
    expect(run(all, 'abc').met).toEqual({
      length: 'false',
      digit: 'false',
      uppercase: 'false',
      lowercase: 'true',
      special: 'false',
    });
  });

  it('counts the length in code points, after normalising, as the server does', () => {
    const lengthOnly = {
      ...all,
      requireDigit: false,
      requireUppercase: false,
      requireLowercase: false,
      requireSpecial: false,
    };
    expect(run(lengthOnly, '\u{1f511}'.repeat(10)).met.length).toBe('true');
    expect(run(lengthOnly, '\u{1f511}'.repeat(9)).met.length).toBe('false');
    expect(run(lengthOnly, 'é'.repeat(9)).met.length).toBe('false');
    expect(run(lengthOnly, 'é'.repeat(10)).met.length).toBe('true');
  });
});
