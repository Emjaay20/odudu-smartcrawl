import type * as IntlModule from 'intl-messageformat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const constructions = vi.hoisted(() => ({ count: 0 }));

vi.mock('intl-messageformat', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & typeof IntlModule>();
  class Counting extends actual.IntlMessageFormat {
    constructor(...args: ConstructorParameters<typeof actual.IntlMessageFormat>) {
      super(...args);
      constructions.count += 1;
    }
  }
  return { ...actual, IntlMessageFormat: Counting };
});

const { createCatalogue } = await import('#/service/catalogue');

const PLURAL = (word: string): string =>
  `{n, plural, zero {zero ${word}} one {one ${word}} two {two ${word}} few {few ${word}} many {many ${word}} other {other ${word}}}`;

const en = {
  greeting: 'Hello, {name}',
  items: '{n, plural, one {# item} other {# items}}',
  'only.en': 'English only',
  due: 'Due {when, date, long}',
  total: 'Total {amount, number}',
};
const ar = {
  greeting: 'مرحبا، {name}',
  items: PLURAL('x'),
  due: 'الموعد {when, date, long}',
  total: 'المجموع {amount, number}',
};
const fr = {
  greeting: 'Bonjour, {name}',
  items: '{n, plural, one {# élément} other {# éléments}}',
};

beforeEach(() => {
  constructions.count = 0;
});

describe('createCatalogue', () => {
  const catalogue = createCatalogue({ en, ar, fr });

  it('lists the locales it holds', () => {
    expect([...catalogue.locales].sort()).toEqual(['ar', 'en', 'fr']);
  });

  it('formats an ICU plural in en', () => {
    expect(catalogue.format('en', 'items', { n: 1 })).toBe('1 item');
    expect(catalogue.format('en', 'items', { n: 2 })).toBe('2 items');
  });

  it('selects all six Arabic plural categories', () => {
    const got = [0, 1, 2, 3, 11, 100].map((n) => catalogue.format('ar', 'items', { n }));
    expect(got).toEqual(['zero x', 'one x', 'two x', 'few x', 'many x', 'other x']);
  });

  it('falls back per key to en when a locale lacks it', () => {
    expect(catalogue.format('fr', 'only.en')).toBe('English only');
    expect(catalogue.format('fr', 'greeting', { name: 'Ada' })).toBe('Bonjour, Ada');
  });

  it('falls back to en for a locale the catalogue does not hold', () => {
    expect(catalogue.format('sw', 'greeting', { name: 'Ada' })).toBe('Hello, Ada');
  });

  it('throws at format time for an unknown id, naming it', () => {
    expect(() => catalogue.format('en', 'nope' as 'greeting')).toThrow(/nope/u);
  });

  it('formats a Date through Intl.DateTimeFormat in the locale', () => {
    const when = new Date(Date.UTC(2026, 9, 15, 12));
    expect(catalogue.format('en', 'due', { when })).toBe(
      `Due ${new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(when)}`,
    );
    expect(catalogue.format('ar', 'due', { when })).toBe(
      `الموعد ${new Intl.DateTimeFormat('ar', { dateStyle: 'long' }).format(when)}`,
    );
  });

  it('formats a number through Intl.NumberFormat in the locale', () => {
    expect(catalogue.format('ar', 'total', { amount: 1234.5 })).toBe(
      `المجموع ${new Intl.NumberFormat('ar').format(1234.5)}`,
    );
  });

  it('does not treat a value as markup or as syntax', () => {
    expect(catalogue.format('en', 'greeting', { name: '<b>{x}</b>' })).toBe('Hello, <b>{x}</b>');
  });

  it('builds a formatter once per locale and id', () => {
    const fresh = createCatalogue({ en, fr });
    fresh.format('fr', 'greeting', { name: 'a' });
    fresh.format('fr', 'greeting', { name: 'b' });
    fresh.format('en', 'greeting', { name: 'c' });
    fresh.format('fr', 'only.en');
    fresh.format('fr', 'only.en');
    expect(constructions.count).toBe(3);
  });
});
