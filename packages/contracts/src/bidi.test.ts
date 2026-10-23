import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BIDI_REFUSED_MESSAGE,
  containsBidiControl,
  noBidiControls,
  refusesBidi,
  stripBidiControls,
} from '#/bidi';

const REFUSED_CODE_POINTS = [
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
] as const;

describe('containsBidiControl', () => {
  it.each(REFUSED_CODE_POINTS)('refuses U+%s', (codePoint) => {
    expect(containsBidiControl(`ada${String.fromCodePoint(codePoint)}`)).toBe(true);
    expect(containsBidiControl(String.fromCodePoint(codePoint))).toBe(true);
  });

  it.each([0x200e, 0x200f, 0x061c])(
    'allows the mark U+%s that Persian and Arabic text uses',
    (cp) => {
      expect(containsBidiControl(`س${String.fromCodePoint(cp)}ل`)).toBe(false);
    },
  );

  it.each(['مرحبا بالعالم', 'שלום עולם', 'Ada Lovelace', 'Ünïcode', ''])(
    'allows plain %s',
    (value) => {
      expect(containsBidiControl(value)).toBe(false);
    },
  );

  it('sees a control that normalisation would leave alone and one it would not create', () => {
    for (const form of ['NFC', 'NFD', 'NFKC', 'NFKD'] as const) {
      const hostile = 'ada\u202Eb'.normalize(form);
      expect(containsBidiControl(hostile)).toBe(true);
    }
  });
});

describe('stripBidiControls', () => {
  it('removes the nine and keeps the marks', () => {
    const all = REFUSED_CODE_POINTS.map((cp) => String.fromCodePoint(cp)).join('');
    expect(stripBidiControls(`a${all}b\u200Fc`)).toBe('ab\u200Fc');
  });
});

describe('noBidiControls', () => {
  const schema = noBidiControls(z.string().min(1));

  it('refuses with the shared message', () => {
    const result = schema.safeParse('ada\u202e');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(BIDI_REFUSED_MESSAGE);
  });

  it('accepts plain right-to-left text', () => {
    expect(schema.safeParse('مرحبا').success).toBe(true);
    expect(schema.safeParse('שלום').success).toBe(true);
  });

  it('survives the JSON Schema a validator is compiled from', () => {
    const emitted = z.toJSONSchema(schema);
    expect(emitted.pattern).toBe('^[^\\u202A-\\u202E\\u2066-\\u2069]*$');
  });

  it('is not undone by Unicode normalisation: no code point normalises into a control', () => {
    for (let cp = 0; cp <= 0x10ffff; cp += 1) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const char = String.fromCodePoint(cp);
      for (const form of ['NFC', 'NFD', 'NFKC', 'NFKD'] as const) {
        const normalised = char.normalize(form);
        if (containsBidiControl(normalised)) {
          expect(containsBidiControl(char), `U+${cp.toString(16)} ${form}`).toBe(true);
        }
      }
    }
  });
});

describe('refusesBidi', () => {
  const held = `old${String.fromCodePoint(0x202e)}name`;

  it('refuses a control that is being added', () => {
    expect(refusesBidi(`x${String.fromCodePoint(0x2066)}`, 'x')).toBe(true);
    expect(refusesBidi(held, 'other')).toBe(true);
    expect(refusesBidi(held)).toBe(true);
    expect(refusesBidi(held, null)).toBe(true);
  });

  it('lets the stored value stand, and takes absent, null and plain values', () => {
    expect(refusesBidi(held, held)).toBe(false);
    expect(refusesBidi(null, held)).toBe(false);
    expect(refusesBidi(undefined, held)).toBe(false);
    expect(refusesBidi('plain', held)).toBe(false);
  });
});
