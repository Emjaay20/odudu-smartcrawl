import { describe, expect, it } from 'vitest';
import { parsePrompt, promptValuesSupported } from '#/service/prompt';

function valuesOf(raw: string | undefined): string[] {
  const parsed = parsePrompt(raw);
  if (parsed.kind !== 'ok') throw new Error(`expected ${String(raw)} to parse`);
  return [...parsed.values].sort();
}

describe('parsePrompt', () => {
  it('reads an absent parameter as no values', () => {
    expect(valuesOf(undefined)).toEqual([]);
  });

  it.each(['', ' ', '   '])('reads %o as no values', (raw) => {
    expect(valuesOf(raw)).toEqual([]);
  });

  it.each(['none', 'login', 'consent', 'select_account', 'create'])(
    'accepts %s on its own',
    (value) => {
      expect(valuesOf(value)).toEqual([value]);
    },
  );

  // Initiating User Registration §4 recommends `create` travel alone, since
  // the other values can contradict it; a request combining them is refused
  // rather than answered by guessing which half the client meant.
  it.each(['create login', 'consent create', 'create select_account', 'none create'])(
    'refuses %s, which combines create with another value',
    (raw) => {
      expect(parsePrompt(raw).kind).toBe('invalid');
    },
  );

  it('collapses a repeated create to one value', () => {
    expect(valuesOf('create create')).toEqual(['create']);
  });

  it('accepts a space-delimited list of defined values', () => {
    expect(valuesOf('login consent')).toEqual(['consent', 'login']);
  });

  it('collapses a repeated value', () => {
    expect(valuesOf('login login')).toEqual(['login']);
  });

  it('tolerates extra separating spaces', () => {
    expect(valuesOf('login  consent')).toEqual(['consent', 'login']);
  });

  it.each(['none login', 'login none', 'none consent', 'none select_account'])(
    'refuses %s, which combines none with another value',
    (raw) => {
      expect(parsePrompt(raw).kind).toBe('invalid');
    },
  );

  it('refuses none combined with an undefined value', () => {
    expect(parsePrompt('none unheard_of').kind).toBe('invalid');
  });

  it.each(['unheard_of', 'login unheard_of'])('refuses %o', (raw) => {
    expect(parsePrompt(raw).kind).toBe('invalid');
  });

  // Case-sensitive: `Login` is not `login`, and guessing at the client's
  // intent is how a request asking for reauthentication gets silently
  // answered without it.
  it.each(['NONE', 'Login', 'Create'])('refuses %s rather than case-folding it', (raw) => {
    expect(parsePrompt(raw).kind).toBe('invalid');
  });
});

describe('promptValuesSupported', () => {
  it('names the four Core values for a tenant with registration off', () => {
    expect(promptValuesSupported({ registrationAllowed: false })).toEqual([
      'none',
      'login',
      'consent',
      'select_account',
    ]);
  });

  it('adds create only for a tenant that lets people register', () => {
    expect(promptValuesSupported({ registrationAllowed: true })).toEqual([
      'none',
      'login',
      'consent',
      'select_account',
      'create',
    ]);
  });
});
